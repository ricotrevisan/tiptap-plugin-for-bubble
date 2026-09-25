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
    """Factory sessions whose ticket hasn't reached a state that releases them.

    `issues` holds only open tickets, so a ticket that was completed, canceled
    or moved out of the project releases its lock. A fix also releases it once
    the ticket was seen in review and then moved back to the queue (rework). A
    dispatch that never finished holds the factory until someone inspects it.
    """
    by_id = {issue['identifier']: issue for issue in issues}
    release = {'fix': policy['states']['releases_fix_lock'],
               'ship': policy['states']['releases_ship_lock']}
    held = []
    for receipt in receipts:
        if receipt.get('status') != 'started':
            held.append(receipt)
            continue
        issue = by_id.get(receipt['identifier'])
        if not issue or issue['state']['name'] in release[receipt['kind']]:
            continue
        if reworking(issue, receipt, policy):
            continue
        held.append(receipt)
    return held


def reworking(issue, receipt, policy):
    return (receipt['kind'] == 'fix' and receipt.get('reachedReview')
            and issue['state']['name'] in policy['intake']['queue_states'])


def mark_reviewed(issues, receipts, policy):
    """Record fix receipts whose ticket is now In Review; returns those changed."""
    in_review = {i['identifier'] for i in issues if i['state']['name'] == policy['states']['in_review']}
    changed = []
    for receipt in receipts:
        if (receipt['kind'] == 'fix' and receipt.get('status') == 'started'
                and not receipt.get('reachedReview') and receipt['identifier'] in in_review):
            receipt['reachedReview'] = True
            changed.append(receipt)
    return changed


def blocked(issue):
    return any(relation['type'] == 'blocks' and relation['issue']['state']['type'] not in ('completed', 'canceled')
               for relation in issue.get('inverseRelations', {}).get('nodes', []))


def claimed_by_someone_else(issue, viewer_id):
    return bool(issue.get('assignee')) and issue['assignee']['id'] != viewer_id


def decide(issues, receipts, policy, dispatched_today=0, viewer_id=None):
    """Return ('ship'|'fix', issue, reason) or (None, None, reason)."""
    if not policy.get('enabled', False):
        return None, None, 'policy disabled'
    states, intake, limits = policy['states'], policy['intake'], policy['limits']
    held = held_locks(issues, receipts, policy)
    if len(held) >= limits['max_active']:
        return None, None, 'busy: ' + ', '.join(
            f"{r['identifier']} ({r['kind']}{'' if r.get('status') == 'started' else ', unfinished dispatch'})"
            for r in held)
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

    # A reviewed ticket moved back to the queue is dispatched again (rework).
    by_id = {i['identifier']: i for i in issues}
    fixed = {r['identifier'] for r in receipts if r['kind'] == 'fix'
             and not (r['identifier'] in by_id and reworking(by_id[r['identifier']], r, policy))}
    blocked_labels = set(intake['human_only_labels'])
    queue = [i for i in issues
             if i['state']['name'] in intake['queue_states']
             and intake['ready_label'] in labels(i)
             and not labels(i) & blocked_labels
             and i['identifier'] not in intake.get('exclude', [])
             and i['identifier'] not in fixed
             and not blocked(i)
             and not claimed_by_someone_else(i, viewer_id)]
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
    """Open tickets in the project, plus the API user's ID."""
    data = linear(policy, '''query($id: String!) {
        organization { urlKey } viewer { id }
        project(id: $id) { issues(first: 100, filter: {state: {type: {nin: ["completed", "canceled"]}}}) {
            pageInfo { hasNextPage }
            nodes { id identifier title url priority createdAt assignee { id }
                state { name } labels(first: 20) { nodes { name } }
                inverseRelations(first: 20) { nodes { type issue { identifier state { type } } } } } } } }''',
                  {'id': policy['linear']['project_id']})
    if data['organization']['urlKey'] != policy['linear']['workspace_url_key']:
        raise RuntimeError('Linear connection points at the wrong workspace')
    issues = data['project']['issues']
    if issues['pageInfo']['hasNextPage']:
        # A lock whose ticket fell off the page would silently release.
        raise RuntimeError('More than 100 open tickets: add pagination before dispatching')
    return issues['nodes'], data['viewer']['id']


def comment(policy, issue, body):
    linear(policy, 'mutation($id: String!, $body: String!) { commentCreate(input: {issueId: $id, body: $body}) { success } }',
           {'id': issue['id'], 'body': body})


def handoff_root(policy):
    return Path(policy['session']['handoff_root'])


def load_receipts(policy):
    """One receipt per dispatch directory. A directory without a readable
    receipt is an unfinished dispatch and counts as a held lock."""
    receipts = []
    for directory in sorted(p for p in handoff_root(policy).glob('*-*') if p.is_dir()):
        identifier, _, kind = directory.name.rpartition('-')
        try:
            receipt = json.loads((directory / 'factory.json').read_text())
        except (OSError, ValueError):
            receipt = dict(identifier=identifier, kind=kind, status='unknown', dispatchedAt=now())
        receipt['directory'] = str(directory)
        receipts.append(receipt)
    return receipts


def save_receipt(receipt):
    data = {key: value for key, value in receipt.items() if key != 'directory'}
    (Path(receipt['directory']) / 'factory.json').write_text(json.dumps(data, indent=2))


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
    previous = directory / 'factory.json'
    attempt = 1
    if kind == 'fix' and previous.exists():
        # Rework of a reviewed ticket: keep earlier receipts for the record.
        attempt = 2
        while (directory / f'factory.{attempt - 1}.json').exists():
            attempt += 1
        for name in ('factory', 'thread-receipt', 'prompt'):
            for suffix in ('.json', '.md'):
                if (directory / f'{name}{suffix}').exists():
                    (directory / f'{name}{suffix}').rename(directory / f'{name}.{attempt - 1}{suffix}')
    else:
        directory.mkdir(parents=True, exist_ok=False)  # never dispatch the same work twice
    receipt_path = directory / 'factory.json'
    receipt = dict(identifier=identifier, kind=kind, status='starting', attempt=attempt, dispatchedAt=now())
    # Written before any side effect: an interrupted dispatch keeps the factory locked.
    receipt_path.write_text(json.dumps(receipt, indent=2))
    values = dict(identifier=identifier, identifier_lower=identifier.lower(),
                  title=issue['title'], url=issue['url'], handoff=str(directory))
    worktree = branch = None
    if kind == 'fix':
        repo = session['repo_root']
        git('fetch', '--quiet', 'origin', cwd=repo)
        base = git('rev-parse', 'origin/main', cwd=repo)
        branch = branch_name(issue)
        worktree = str(Path(session['worktree_root']) / branch.split('/', 1)[1])
        if Path(worktree).exists():
            pass  # rework: continue in the ticket's existing worktree
        elif subprocess.run(['git', 'rev-parse', '--verify', '--quiet', 'refs/heads/' + branch], cwd=repo,
                            capture_output=True).returncode == 0:
            git('worktree', 'add', '--quiet', worktree, branch, cwd=repo)
        else:
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
    title = f"{identifier} — {'ship' if kind == 'ship' else issue['title']}"[:70]
    if attempt > 1:
        title += f' (rework {attempt - 1})'
    result = helper.start(client, argparse.Namespace(
        workspace=session['repo_root'], worktree=worktree, branch=branch, title=title,
        source_thread=session['source_thread'], prompt_file=str(prompt_file), prompt=None,
        receipt=str(directory / 'thread-receipt.json')))
    thread_id = result['receipt']['threadId']
    receipt.update(status='started', threadId=thread_id, branch=branch, worktree=worktree)
    receipt_path.write_text(json.dumps(receipt, indent=2))
    comment(policy, issue, f"Factory started a {kind} session: T3 thread `{thread_id}`"
            + (f", branch `{branch}`, worktree `{worktree}`." if branch else '.'))
    return receipt


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')


def dispatched_today(receipts):
    today = now()[:10]
    return sum(1 for r in receipts if r['dispatchedAt'][:10] == today)


def status(policy):
    issues = {i['identifier']: i for i in fetch_issues(policy)[0]}
    receipts = load_receipts(policy)
    mark_reviewed(list(issues.values()), receipts, policy)  # in memory: status never writes
    held = {(r['identifier'], r['kind']) for r in held_locks(list(issues.values()), receipts, policy)}
    helper = t3_helper(policy)
    threads = {t['id']: t for t in t3_client(policy, helper).snapshot()['threads']}
    rows = []
    for r in receipts:
        thread = threads.get(r.get('threadId'), {})
        turn = (thread.get('latestTurn') or {}).get('state')
        updated = thread.get('updatedAt') or r['dispatchedAt']
        idle_hours = (datetime.datetime.now(datetime.timezone.utc)
                      - datetime.datetime.fromisoformat(updated.replace('Z', '+00:00'))).total_seconds() / 3600
        holding = (r['identifier'], r['kind']) in held
        rows.append(dict(ticket=r['identifier'], kind=r['kind'],
                         state=issues.get(r['identifier'], {}).get('state', {}).get('name'),
                         status=r.get('status'), thread=r.get('threadId'), turn=turn,
                         idleHours=round(idle_hours, 1),
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
    issues, viewer_id = fetch_issues(policy)
    for receipt in mark_reviewed(issues, receipts, policy):
        if args.dispatch:  # a dry run never writes
            save_receipt(receipt)
    kind, issue, reason = decide(issues, receipts, policy, dispatched_today(receipts), viewer_id)
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
