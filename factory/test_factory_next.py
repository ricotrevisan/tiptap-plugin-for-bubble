import copy
import string
import subprocess
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import factory_next as factory

POLICY = factory.load_policy()


def issue(identifier, state='Todo', labels=('ready-for-agent',), priority=3, created='2026-09-01', title='Do a thing'):
    return {'id': identifier.lower(), 'identifier': identifier, 'title': title, 'url': 'https://linear.test/' + identifier,
            'priority': priority, 'createdAt': created, 'state': {'name': state},
            'labels': {'nodes': [{'name': name} for name in labels]}}


def receipt(identifier, kind='fix', at='2026-09-01T00:00:00+00:00', status='started', **extra):
    return {'identifier': identifier, 'kind': kind, 'status': status, 'threadId': 't-' + identifier,
            'dispatchedAt': at, **extra}


def decide(issues, receipts=(), policy=POLICY, today=0, viewer='me'):
    kind, chosen, reason = factory.decide(issues, list(receipts), policy, today, viewer)
    return kind, chosen and chosen['identifier'], reason


class Decide(unittest.TestCase):
    def test_picks_ready_ticket_by_state_then_priority_then_age(self):
        issues = [issue('WTF-1', 'Backlog', priority=1), issue('WTF-2', priority=3, created='2026-09-02'),
                  issue('WTF-3', priority=3, created='2026-09-01'), issue('WTF-4', priority=0)]
        self.assertEqual(decide(issues)[:2], ('fix', 'WTF-3'))
        self.assertEqual(decide([issue('WTF-4', priority=0), issue('WTF-5', priority=4)])[:2], ('fix', 'WTF-5'))

    def test_skips_unready_human_only_excluded_and_already_dispatched(self):
        issues = [issue('WTF-1', labels=()), issue('WTF-2', labels=('ready-for-agent', 'requires-subscription')),
                  issue('WTF-3', labels=('ready-for-agent', 'needs-info')), issue('WTF-4', 'In Review'),
                  issue('WTF-5', 'Done'), issue('WTF-6')]
        self.assertEqual(decide(issues, [receipt('WTF-6')])[:2], (None, None))
        policy = copy.deepcopy(POLICY)
        policy['intake']['exclude'] = ['WTF-7']
        self.assertEqual(decide([issue('WTF-7')], policy=policy)[:2], (None, None))

    def test_one_ticket_at_a_time(self):
        # A dispatched fix holds the factory until its ticket reaches review.
        for state in ('Todo', 'In Progress'):
            kind, _, reason = decide([issue('WTF-1', state), issue('WTF-2')], [receipt('WTF-1')])
            self.assertIsNone(kind)
            self.assertIn('WTF-1', reason)
        self.assertEqual(decide([issue('WTF-1', 'In Review'), issue('WTF-2')], [receipt('WTF-1')])[:2], ('fix', 'WTF-2'))
        # Work started outside the factory holds it too.
        self.assertIsNone(decide([issue('WTF-1', 'In Progress', labels=()), issue('WTF-2')])[0])

    def test_unfinished_dispatch_holds_the_factory(self):
        # Interrupted before the session was recorded: fail closed until inspected.
        for status in ('starting', 'unknown'):
            kind, _, reason = decide([issue('WTF-1', 'In Review'), issue('WTF-2')], [receipt('WTF-1', status=status)])
            self.assertIsNone(kind)
            self.assertIn('unfinished dispatch', reason)
        # Even when its ticket has left the open set.
        self.assertIsNone(decide([issue('WTF-2')], [receipt('WTF-1', status='starting')])[0])

    def test_closed_ticket_releases_its_lock(self):
        self.assertEqual(decide([issue('WTF-2')], [receipt('WTF-1')])[:2], ('fix', 'WTF-2'))

    def test_rework_after_review(self):
        todo = [issue('WTF-1'), issue('WTF-2', priority=4)]
        # Dispatched, not yet started: holds, and isn't picked again.
        self.assertIsNone(decide(todo, [receipt('WTF-1')])[0])
        # Seen in review, then moved back to Todo: picked again for rework.
        reviewed = receipt('WTF-1')
        self.assertEqual([r['identifier'] for r in factory.mark_reviewed([issue('WTF-1', 'In Review')], [reviewed], POLICY)],
                         ['WTF-1'])
        self.assertEqual(decide(todo, [reviewed])[:2], ('fix', 'WTF-1'))
        self.assertEqual(factory.mark_reviewed([issue('WTF-1', 'In Review')], [reviewed], POLICY), [], 'marked once')

    def test_skips_blocked_and_claimed_tickets(self):
        blocker = {'type': 'blocks', 'issue': {'identifier': 'WTF-9', 'state': {'type': 'started'}}}
        done_blocker = {'type': 'blocks', 'issue': {'identifier': 'WTF-8', 'state': {'type': 'completed'}}}
        related = {'type': 'related', 'issue': {'identifier': 'WTF-7', 'state': {'type': 'started'}}}
        a, b, c = issue('WTF-1'), issue('WTF-2'), issue('WTF-3')
        a['inverseRelations'] = {'nodes': [blocker]}
        b['inverseRelations'] = {'nodes': [done_blocker, related]}
        c['assignee'] = {'id': 'someone-else'}
        self.assertEqual(decide([a, b, c])[:2], ('fix', 'WTF-2'))
        c['assignee'] = {'id': 'me'}
        self.assertEqual(decide([a, c])[:2], ('fix', 'WTF-3'))

    def test_ship_label_wins_and_holds_until_done(self):
        issues = [issue('WTF-1', 'In Review', labels=('ship-approved',)), issue('WTF-2')]
        self.assertEqual(decide(issues)[:2], ('ship', 'WTF-1'))
        shipping = [receipt('WTF-1', 'ship')]
        self.assertIsNone(decide(issues, shipping)[0], 'a blocked ship keeps the factory stopped')
        del issues[0]  # Done tickets aren't fetched
        self.assertEqual(decide(issues, shipping)[:2], ('fix', 'WTF-2'))

    def test_withdrawn_ship_releases_and_can_ship_again(self):
        approved = issue('WTF-1', 'In Review', labels=('ship-approved',))
        withdrawn = issue('WTF-1', 'In Review', labels=())
        ship = receipt('WTF-1', 'ship')
        self.assertIsNone(decide([approved, issue('WTF-2')], [ship])[0])
        # The session blocked and removed the label; the factory notices.
        self.assertEqual(factory.mark_reviewed([withdrawn], [ship], POLICY), [ship])
        self.assertEqual(decide([withdrawn, issue('WTF-2')], [ship])[:2], ('fix', 'WTF-2'))
        # The maintainer adds the label again: ship again.
        self.assertEqual(decide([approved, issue('WTF-2')], [ship])[:2], ('ship', 'WTF-1'))

    def test_review_backlog_limit(self):
        waiting = [issue(f'WTF-{n}', 'In Review') for n in range(1, 4)]
        self.assertIsNone(decide(waiting + [issue('WTF-9')])[0])
        self.assertEqual(decide(waiting[:2] + [issue('WTF-9')])[:2], ('fix', 'WTF-9'))

    def test_daily_limit_and_disable(self):
        self.assertIsNone(decide([issue('WTF-1')], today=4)[0])
        policy = copy.deepcopy(POLICY)
        policy['enabled'] = False
        self.assertIsNone(decide([issue('WTF-1')], policy=policy)[0])


class Dispatch(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.policy = copy.deepcopy(POLICY)
        self.policy['session']['handoff_root'] = self.tmp.name
        self.comments = []
        patches = [mock.patch.object(factory, 'comment', lambda policy, issue, body: self.comments.append(body)),
                   mock.patch.object(factory, 't3_client', lambda policy, helper: FakeClient())]
        for patch in patches:
            patch.start()
            self.addCleanup(patch.stop)

    def tearDown(self):
        self.tmp.cleanup()

    def helper(self, fail=False):
        seen = {}

        def start(client, args):
            source = next(t for t in client.snapshot()['threads'] if t['id'] == args.source_thread)
            seen.update(model=source['modelSelection'], runtime=source['runtimeMode'], title=args.title)
            if fail:
                raise RuntimeError('T3 HTTP 500')
            return {'receipt': {'threadId': 'thread-1'}}
        return mock.patch.object(factory, 't3_helper', lambda policy: SimpleNamespace(start=start)), seen

    def test_ship_session_uses_policy_model_and_records_the_lock(self):
        patch, seen = self.helper()
        with patch:
            factory.dispatch(self.policy, 'ship', issue('WTF-1', 'In Review', labels=('ship-approved',)))
        self.assertEqual(seen['model'], self.policy['session']['model'])
        self.assertEqual(seen['runtime'], 'full-access')
        receipts = factory.load_receipts(self.policy)
        self.assertEqual([(r['identifier'], r['kind'], r['status'], r['threadId']) for r in receipts],
                         [('WTF-1', 'ship', 'started', 'thread-1')])
        self.assertIn('thread-1', self.comments[0])
        with self.assertRaises(FileExistsError):
            factory.dispatch(self.policy, 'ship', issue('WTF-1', 'In Review'))

    def test_failed_start_keeps_the_factory_locked(self):
        patch, _ = self.helper(fail=True)
        with patch, self.assertRaises(RuntimeError):
            factory.dispatch(self.policy, 'ship', issue('WTF-1', 'In Review', labels=('ship-approved',)))
        receipts = factory.load_receipts(self.policy)
        self.assertEqual(receipts[0]['status'], 'starting')
        self.assertIsNone(decide([issue('WTF-2')], receipts, self.policy)[0])
        self.assertEqual(self.comments, [])


    def test_rework_reuses_branch_and_worktree(self):
        root = Path(self.tmp.name)
        origin, repo = root / 'origin.git', root / 'repo'
        run = lambda *args, cwd=root: subprocess.run(args, cwd=cwd, check=True, capture_output=True)
        run('git', 'init', '--quiet', '--bare', '-b', 'main', str(origin))
        run('git', 'clone', '--quiet', str(origin), str(repo))
        run('git', '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--quiet', '--allow-empty', '-m', 'init', cwd=repo)
        run('git', 'push', '--quiet', 'origin', 'main', cwd=repo)
        self.policy['session'].update(repo_root=str(repo), worktree_root=str(root / 'worktrees'),
                                      handoff_root=str(root / 'handoffs'))
        patch, seen = self.helper()
        with patch:
            first = factory.dispatch(self.policy, 'fix', issue('WTF-5', title='Original title'))
            self.assertEqual(first['branch'], 'feat/wtf-5-original-title')
            self.assertTrue(Path(first['worktree']).is_dir())
            [reviewed] = factory.load_receipts(self.policy)
            factory.mark_reviewed([issue('WTF-5', 'In Review')], [reviewed], self.policy)
            factory.save_receipt(reviewed)
            second = factory.dispatch(self.policy, 'fix', issue('WTF-5', title='Renamed while in review'))
        self.assertEqual((second['branch'], second['worktree'], second['attempt']),
                         (first['branch'], first['worktree'], 2))
        self.assertTrue(seen['title'].endswith('(rework 1)'))
        handoff = Path(self.policy['session']['handoff_root']) / 'WTF-5-fix'
        self.assertTrue((handoff / 'factory.1.json').exists() and (handoff / 'prompt.1.md').exists())


class FakeClient:
    def snapshot(self):
        return {'threads': [{'id': POLICY['session']['source_thread'], 'modelSelection': {'model': 'other'},
                             'runtimeMode': 'approval-required'}]}


class Helpers(unittest.TestCase):
    def test_branch_name(self):
        self.assertEqual(factory.branch_name(issue('WTF-262', labels=('Bug',),
                         title='Verify and fix typing after a link continuing inside the link')),
                         'fix/wtf-262-verify-and-fix-typing-after-a-link-conti')
        self.assertEqual(factory.branch_name(issue('WTF-9', title='Add: Math (LaTeX)!')), 'feat/wtf-9-add-math-latex')

    def test_prompts_render_with_every_placeholder(self):
        values = dict(identifier='WTF-1', identifier_lower='wtf-1', title='T', url='U',
                      worktree='W', branch='B', base_sha='abc1234', handoff='H')
        for name in ('fix', 'ship'):
            text = factory.render(POLICY, name, **values)
            self.assertNotIn('$', text.replace('$identifier', ''), name)
            self.assertIn('WTF-1', text)
        for name in ('fix', 'ship'):
            template = string.Template((Path(factory.FACTORY) / f'prompts/{name}.md').read_text())
            self.assertLessEqual(set(template.get_identifiers()) - set(values),
                                 {'repo_root', 'worktree_root', 'linear_ticket_cli'})


if __name__ == '__main__':
    unittest.main()
