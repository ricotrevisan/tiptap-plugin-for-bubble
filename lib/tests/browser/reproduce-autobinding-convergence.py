"""Real rapid typing must converge in the database and survive a reload.
Requires an authenticated agent-browser session wtf260 on the disposable fixture.
"""
import argparse
import json
import time
from autobinding_test_support import begin, browser, network_probe, state, wait_settled, reload_and_verify

parser = argparse.ArgumentParser()
parser.add_argument('--delay', type=int, choices=[0, 300, 2200], default=0)
args = parser.parse_args()
backup = begin(args.delay)
network_probe()
browser('click', '.ProseMirror')
browser('press', 'Control+End')
browser('press', 'Enter')
for trial in range(5):
    for burst in range(3):
        browser('keyboard', 'type', f' [{trial}.{burst}] abcdefghijklmnopqrstuvwxyz ')
        time.sleep(.1)
    expected = state()['html']
    network = wait_settled(expected)
    print(json.dumps({'trial': trial, 'saveDelay': args.delay, 'databaseMatches': True,
                      'htmlLength': len(expected), 'requests': len(network['requests'])}), flush=True)
reload_and_verify(expected)
print(json.dumps({'reloadPreservedText': True, 'backup': str(backup)}))
