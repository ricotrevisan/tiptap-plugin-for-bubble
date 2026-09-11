"""A submitted A request held across navigation must remain associated with A."""
import json
import time
from autobinding_test_support import (begin, browser, click, evaluate, state,
    database_html, network_probe, wait_settled, reload_and_verify, wait_ready, RECORD_A, RECORD_B)

backup = begin(2200)
b_before = database_html(RECORD_B)
network_probe(hold_first_ms=5000)
browser('click', '.ProseMirror'); browser('press', 'Control+End')
browser('keyboard', 'type', ' INFLIGHT-A')
expected_a = state()['html']
deadline = time.monotonic() + 5
while not evaluate('window.__wtf260Network.requests.length'):
    assert time.monotonic() < deadline, 'A did not submit its save'
    time.sleep(.1)
assert evaluate('window.__wtf260Network.pending') == 1
click('Record B'); wait_ready(RECORD_B)
assert state()['id'] == RECORD_B and state()['html'] == b_before
browser('click', '.ProseMirror'); browser('press', 'Control+End')
browser('keyboard', 'type', ' INFLIGHT-B')
expected_b = state()['html']
network = wait_settled(expected_b, RECORD_B)
assert database_html(RECORD_A) == expected_a
assert database_html(RECORD_B) == expected_b
reload_and_verify(expected_b, RECORD_B)
print(json.dumps({'inflightAStayedOnA': True, 'recordBPersisted': True,
    'reloadPreservedText': True, 'responseOrder': [x['index'] for x in network['responses']],
    'backup': str(backup)}, indent=2))
