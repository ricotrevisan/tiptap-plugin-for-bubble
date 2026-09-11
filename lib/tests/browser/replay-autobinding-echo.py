"""Replay a delayed save echo through Bubble's reactive cache after real typing.
Run only against the disposable WTF-260 fixture. This mutates its test record.
Requires agent-browser session wtf260 already open on the fixture.
"""
import argparse, json, subprocess, time
from autobinding_test_support import begin, network_probe, wait_settled, reload_and_verify
parser = argparse.ArgumentParser()
parser.add_argument("--delay", type=int, choices=[0, 300], default=0)
args = parser.parse_args()
backup = begin(args.delay)
network_probe()
BASE = ['agent-browser', '--session', 'wtf260', '--json']
def browser(*args):
    r = subprocess.run(BASE + list(args), capture_output=True, text=True)
    result = json.loads(r.stdout)
    if not result['success']: raise RuntimeError(result.get('error'))
    return result['data']
def evaluate(js): return browser('eval', js).get('result')
url = evaluate('location.href')
assert '/version-33jpy/wtf-260-autobinding' in url, url
browser('find', 'role', 'button', 'click', '--name', f'Delay {args.delay}', '--exact')
browser('find', 'role', 'button', 'click', '--name', 'Record A', '--exact')
time.sleep(.5)
browser('click', '.ProseMirror')
browser('press', 'End')
browser('keyboard', 'type', ' warmup')
time.sleep(.6)
assert evaluate('document.querySelector("#wtf260-editor").bubble_data.bubble_instance._plugin_data.delay') == args.delay
browser('keyboard', 'type', ' first')
time.sleep(.5)
evaluate('window.__wtf260Echo = document.querySelector(".ProseMirror").editor.getHTML()')
browser('keyboard', 'type', ' second')
time.sleep(.5)
selection = evaluate('document.querySelector(".ProseMirror").editor.state.selection.from')
before = evaluate('document.querySelector(".ProseMirror").editor.getHTML()')
# This changes only the disposable record's client cache, simulating an older
# server/watch response. Bubble then calls the real plugin update lifecycle.
evaluate('document.querySelector("#wtf260-editor").bubble_data.bubble_instance.parent().state("group_data").child("html_text").set(window.__wtf260Echo)')
time.sleep(.5)
after = evaluate('document.querySelector(".ProseMirror").editor.getHTML()')
assert evaluate('document.querySelector(".ProseMirror").editor.state.selection.from') == selection
print(json.dumps({'url':url, 'delay':args.delay, 'htmlLength':len(before), 'selectionPreserved':True, 'preserved':after==before}, indent=2))
assert after == before, 'A delayed Bubble save echo removed newer real keystrokes'

# The controller must reconcile the stale cache itself and retain the text in
# the real database. Do not manually restore the optimistic property here.
wait_settled(before)
reload_and_verify(before)
print(json.dumps({'databaseMatches': True, 'reloadPreservedText': True, 'backup': str(backup)}))
