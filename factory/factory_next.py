#!/usr/bin/env python3
"""Tiptap software factory: start the next T3 session, one ticket at a time.

  factory_next.py            show what would happen (no writes)
  factory_next.py --dispatch start the next ship or fix session
  factory_next.py status     list factory sessions and flag stalled ones

Policy lives in factory/policy.toml; factory/README.md explains the loop.
"""
import argparse
import datetime
import importlib.util
import json
import re
import string
import subprocess
import sys
import tomllib
from pathlib import Path

FACTORY = Path(__file__).resolve().parent
STALL_HOURS = 6


def load_policy(path=FACTORY / 'policy.toml'):
    with open(path, 'rb') as f:
        return tomllib.load(f)


# ── Decision (pure; see test_factory_next.py) ────────────────────────────────

def labels(issue):
    return {label['name'] for label in issue['labels']['nodes']}


def held_locks(issues, receipts, policy):
    """Factory sessions whose ticket hasn't reached a state that releases them."""
    by_id = {issue['identifier']: issue for issue in issues}
    release = {'fix': policy['states']['releases_fix_lock'],
               'ship': policy['states']['releases_ship_lock']}
    held = []
    for receipt in receipts:
        issue = by_id.get(receipt['identifier'])
        # A ticket that left the project no longer holds the factory.
        if issue and issue['state']['name'] not in release[receipt['kind']]:
            held.append(receipt)
    return held


def decide(issues, receipts, policy, dispatched_today=0):
    """Return ('ship'|'fix', issue, reason) or (None, None, reason)."""
    if not policy.get('enabled', False):
        return None, None, 'policy disabled'
    states, intake, limits = policy['states'], policy['intake'], policy['limits']
    held = held_locks(issues, receipts, policy)
    if len(held) >= limits['max_active']:
        return None, None, 'busy: ' + ', '.join(f"{r['identifier']} ({r['kind']})" for r in held)
    # Someone (human or agent) working outside the factory also holds the slot.
    in_progress = [i['identifier'] for i in issues if i['state']['name'] == states['in_progress']
                   and i['identifier'] not in {r['identifier'] for r in held}]
    if len(in_progress) + len(held) >= limits['max_active']:
        return None, None, 'busy: in progress ' + ', '.join(in_progress)
    if dispatched_today >= limits['max_dispatches_per_day']:
        return None, None, 'daily dispatch limit reached'

    shipped = {r['identifier'] for r in receipts if r['kind'] == 'ship'}
    ship_label = policy['promotion']['ship_label']
    to_ship = [i for i in issues if i['state']['name'] == states['in_review']
               and ship_label in labels(i) and i['identifier'] not in shipped]
    if to_ship:
        issue = sorted(to_ship, key=sort_key(policy))[0]
        return 'ship', issue, f"{ship_label} on {issue['identifier']}"

    waiting = [i for i in issues if i['state']['name'] == states['in_review']]
    if len(waiting) >= limits['max_waiting_review']:
        return None, None, f'{len(waiting)} tickets wait for review'

    fixed = {r['identifier'] for r in receipts if r['kind'] == 'fix'}
    blocked_labels = set(intake['human_only_labels'])
    queue = [i for i in issues
             if i['state']['name'] in intake['queue_states']
             and intake['ready_label'] in labels(i)
             and not labels(i) & blocked_labels
             and i['identifier'] not in intake.get('exclude', [])
             and i['identifier'] not in fixed]
    if not queue:
        return None, None, 'queue empty'
    issue = sorted(queue, key=sort_key(policy))[0]
    return 'fix', issue, 'next in queue'


def sort_key(policy):
    order = {name: rank for rank, name in enumerate(policy['intake']['queue_states'])}
    # Linear priority: 1 urgent … 4 low, 0 none (last).
    return lambda i: (order.get(i['state']['name'], len(order)), i['priority'] or 5, i['createdAt'])


def branch_name(issue):
    slug = re.sub(r'[^a-z0-9]+', '-', issue['title'].lower()).strip('-')[:40].rstrip('-')
    prefix = 'fix' if 'Bug' in labels(issue) else 'feat'
    return f"{prefix}/{issue['identifier'].lower()}-{slug}"


# ── Side effects ─────────────────────────────────────────────────────────────

def linear(policy, query, variables=None):
    body = json.dumps({'query': query, 'variables': variables or {}})
    out = subprocess.run([str(Path.home() / '.local/bin/loggie-account'), policy['linear']['loggie_account'],
                          'call', 'linear', 'POST', '/graphql', '-b', body],
                         capture_output=True, text=True, timeout=60)
    data = json.loads(out.stdout) if out.stdout.strip().startswith('{') else None
    if out.returncode or not data or data.get('errors') or 'data' not in data:
        raise RuntimeError(f'Linear call failed: {out.stderr.strip() or out.stdout.strip()[:300]}')
    return data['data']


def fetch_issues(policy):
    data = linear(policy, '''query($id: String!) {
        organization { urlKey }
        project(id: $id) { issues(first: 250) { nodes {
            id identifier title url priority createdAt
            state { name } labels { nodes { name } } } } } }''',
                  {'id': policy['linear']['project_id']})
    if data['organization']['urlKey'] != policy['linear']['workspace_url_key']:
        raise RuntimeError('Linear connection points at the wrong workspace')
    return data['project']['issues']['nodes']


def comment(policy, issue, body):
    linear(policy, 'mutation($id: String!, $body: String!) { commentCreate(input: {issueId: $id, body: $body}) { success } }',
           {'id': issue['id'], 'body': body})


def handoff_root(policy):
    return Path(policy['session']['handoff_root'])


def load_receipts(policy):
    receipts = []
    for path in sorted(handoff_root(policy).glob('*/factory.json')):
        receipts.append(json.loads(path.read_text()))
    return receipts


def t3_helper(policy):
    spec = importlib.util.spec_from_file_location('t3_threads', policy['session']['t3_helper'])
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def t3_client(policy, helper):
    return helper.Client(Path('~/.t3').expanduser().resolve(), None, 'node', False)


def git(*args, cwd):
    return subprocess.run(['git', *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def render(policy, name, **values):
    session = policy['session']
    template = string.Template((FACTORY / 'prompts' / f'{name}.md').read_text())
    return template.substitute(repo_root=session['repo_root'], worktree_root=session['worktree_root'],
                               linear_ticket_cli=session['linear_ticket_cli'], **values)


def dispatch(policy, kind, issue):
    session = policy['session']
    identifier = issue['identifier']
    directory = handoff_root(policy) / f'{identifier}-{kind}'
    directory.mkdir(parents=True, exist_ok=False)  # never dispatch the same work twice
    values = dict(identifier=identifier, identifier_lower=identifier.lower(),
                  title=issue['title'], url=issue['url'])
    worktree = branch = None
    if kind == 'fix':
        repo = session['repo_root']
        git('fetch', '--quiet', 'origin', cwd=repo)
        base = git('rev-parse', 'origin/main', cwd=repo)
        branch = branch_name(issue)
        worktree = str(Path(session['worktree_root']) / branch.split('/', 1)[1])
        git('worktree', 'add', '--quiet', '--no-track', '-b', branch, worktree, base, cwd=repo)
        values.update(worktree=worktree, branch=branch, base_sha=base[:7])
    prompt_file = directory / 'prompt.md'
    prompt_file.write_text(render(policy, kind, **values))

    helper = t3_helper(policy)
    client = t3_client(policy, helper)
    snapshot = client.snapshot

    def with_factory_settings():
        # The helper copies model and runtime from the source thread; apply ours.
        state = snapshot()
        for thread in state['threads']:
            if thread['id'] == session['source_thread']:
                thread['modelSelection'] = session['model']
                thread['runtimeMode'] = session['runtime_mode']
        return state
    client.snapshot = with_factory_settings
    title = f"{identifier} — {'ship' if kind == 'ship' else issue['title']}"[:80]
    result = helper.start(client, argparse.Namespace(
        workspace=session['repo_root'], worktree=worktree, branch=branch, title=title,
        source_thread=session['source_thread'], prompt_file=str(prompt_file), prompt=None,
        receipt=str(directory / 'thread-receipt.json')))
    thread_id = result['receipt']['threadId']
    receipt = dict(identifier=identifier, kind=kind, threadId=thread_id, branch=branch,
                   worktree=worktree, dispatchedAt=now())
    (directory / 'factory.json').write_text(json.dumps(receipt, indent=2))
    comment(policy, issue, f"Factory started a {kind} session: T3 thread `{thread_id}`"
            + (f", branch `{branch}`, worktree `{worktree}`." if branch else '.'))
    return receipt


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')


def dispatched_today(receipts):
    today = now()[:10]
    return sum(1 for r in receipts if r['dispatchedAt'][:10] == today)


def status(policy):
    issues = {i['identifier']: i for i in fetch_issues(policy)}
    receipts = load_receipts(policy)
    held = {(r['identifier'], r['kind']) for r in held_locks(list(issues.values()), receipts, policy)}
    helper = t3_helper(policy)
    threads = {t['id']: t for t in t3_client(policy, helper).snapshot()['threads']}
    rows = []
    for r in receipts:
        thread = threads.get(r['threadId'], {})
        turn = (thread.get('latestTurn') or {}).get('state')
        updated = thread.get('updatedAt') or r['dispatchedAt']
        idle_hours = (datetime.datetime.now(datetime.timezone.utc)
                      - datetime.datetime.fromisoformat(updated.replace('Z', '+00:00'))).total_seconds() / 3600
        holding = (r['identifier'], r['kind']) in held
        rows.append(dict(ticket=r['identifier'], kind=r['kind'],
                         state=issues.get(r['identifier'], {}).get('state', {}).get('name'),
                         thread=r['threadId'], turn=turn, idleHours=round(idle_hours, 1),
                         holdsFactory=holding,
                         stalled=holding and turn != 'running' and idle_hours >= STALL_HOURS))
    return rows


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('command', nargs='?', choices=['next', 'status'], default='next')
    parser.add_argument('--dispatch', action='store_true', help='actually start the session')
    args = parser.parse_args()
    policy = load_policy()
    if args.command == 'status':
        print(json.dumps(status(policy), indent=2))
        return
    if (handoff_root(policy) / 'PAUSE').exists():
        print(json.dumps({'action': None, 'reason': 'paused'}))
        return
    receipts = load_receipts(policy)
    kind, issue, reason = decide(fetch_issues(policy), receipts, policy, dispatched_today(receipts))
    decision = {'action': kind, 'ticket': issue and issue['identifier'], 'reason': reason,
                'dryRun': not args.dispatch}
    if kind and args.dispatch:
        decision['receipt'] = dispatch(policy, kind, issue)
    print(json.dumps(decision, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:  # the timer's journal is the only reader
        print(json.dumps({'error': str(error)}), file=sys.stderr)
        sys.exit(1)
