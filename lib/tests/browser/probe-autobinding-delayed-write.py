"""Hold an older native Bubble save for five seconds, then verify recovery.
The probe changes network timing only; it does not patch the saving algorithm.
Requires an authenticated agent-browser session wtf260 on the disposable fixture.
"""
import json
import time
from autobinding_test_support import begin, browser, network_probe, state, wait_settled, reload_and_verify

backup = begin(2200)
network_probe(hold_first_ms=5000)
browser('click', '.ProseMirror')
browser('press', 'Control+End')
browser('keyboard', 'type', ' SLOW-OLDER')
time.sleep(2.5)
browser('keyboard', 'type', ' NEWER-MUST-PERSIST')
expected = state()['html']
network = wait_settled(expected)
order = [x['index'] for x in network['responses']]
assert len(order) >= 3 and order.index(1) < order.index(0), network
reload_and_verify(expected)
print(json.dumps({'databaseMatches': True, 'reloadPreservedText': True,
                  'responseOrder': order, 'requests': len(network['requests']), 'backup': str(backup)}, indent=2))
