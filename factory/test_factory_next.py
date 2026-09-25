import copy
import string
import unittest
from pathlib import Path

import factory_next as factory

POLICY = factory.load_policy()


def issue(identifier, state='Todo', labels=('ready-for-agent',), priority=3, created='2026-09-01', title='Do a thing'):
    return {'id': identifier.lower(), 'identifier': identifier, 'title': title, 'url': 'https://linear.test/' + identifier,
            'priority': priority, 'createdAt': created, 'state': {'name': state},
            'labels': {'nodes': [{'name': name} for name in labels]}}


def receipt(identifier, kind='fix', at='2026-09-01T00:00:00+00:00'):
    return {'identifier': identifier, 'kind': kind, 'threadId': 't-' + identifier, 'dispatchedAt': at}


def decide(issues, receipts=(), policy=POLICY, today=0):
    kind, chosen, reason = factory.decide(issues, list(receipts), policy, today)
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

    def test_ship_label_wins_and_holds_until_done(self):
        issues = [issue('WTF-1', 'In Review', labels=('ship-approved',)), issue('WTF-2')]
        self.assertEqual(decide(issues)[:2], ('ship', 'WTF-1'))
        shipping = [receipt('WTF-1', 'ship')]
        self.assertIsNone(decide(issues, shipping)[0], 'a blocked ship keeps the factory stopped')
        issues[0]['state']['name'] = 'Done'
        self.assertEqual(decide(issues, shipping)[:2], ('fix', 'WTF-2'))

    def test_review_backlog_limit(self):
        waiting = [issue(f'WTF-{n}', 'In Review') for n in range(1, 4)]
        self.assertIsNone(decide(waiting + [issue('WTF-9')])[0])
        self.assertEqual(decide(waiting[:2] + [issue('WTF-9')])[:2], ('fix', 'WTF-9'))

    def test_daily_limit_and_disable(self):
        self.assertIsNone(decide([issue('WTF-1')], today=4)[0])
        policy = copy.deepcopy(POLICY)
        policy['enabled'] = False
        self.assertIsNone(decide([issue('WTF-1')], policy=policy)[0])


class Helpers(unittest.TestCase):
    def test_branch_name(self):
        self.assertEqual(factory.branch_name(issue('WTF-262', labels=('Bug',),
                         title='Verify and fix typing after a link continuing inside the link')),
                         'fix/wtf-262-verify-and-fix-typing-after-a-link-conti')
        self.assertEqual(factory.branch_name(issue('WTF-9', title='Add: Math (LaTeX)!')), 'feat/wtf-9-add-math-latex')

    def test_prompts_render_with_every_placeholder(self):
        values = dict(identifier='WTF-1', identifier_lower='wtf-1', title='T', url='U',
                      worktree='W', branch='B', base_sha='abc1234')
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
