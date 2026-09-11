"""Verify pending edits never save into a newly selected fixture record."""
import json
import time
from autobinding_test_support import (begin, browser, click, state, database_html,
    network_probe, wait_settled, reload_and_verify, RECORD_A, RECORD_B)

backup = begin(300)
network_probe()
click('Record B'); time.sleep(.5)
b = state()
assert b['id'] == RECORD_B
assert database_html(RECORD_B) == b['html']
click('Record A'); time.sleep(.5)
a_before = database_html(RECORD_A)
click('Switch to B in 1 second')
started = time.monotonic()
browser('click', '.ProseMirror'); browser('press', 'Control+End')
time.sleep(max(0, .72 - (time.monotonic() - started)))
browser('keyboard', 'type', ' PENDING-A-NAV')
pending = state()
assert pending['pending'] and pending['id'] == RECORD_A, pending
time.sleep(1)
assert state()['id'] == RECORD_B and state()['html'] == b['html']
wait_settled(b['html'], RECORD_B)
assert database_html(RECORD_A) == a_before, 'The pending A edit should have been cancelled'
click('Record A'); click('Hide editor'); click('Record B'); click('Show editor'); time.sleep(.5)
assert state()['html'] == b['html']
reload_and_verify(b['html'], RECORD_B)
browser('click', '.ProseMirror'); browser('press', 'Control+End')
browser('keyboard', 'type', ' SAVED-B-NAV')
saved_b = state()['html']
wait_settled(saved_b, RECORD_B)
reload_and_verify(saved_b, RECORD_B)
assert state()['auto'] is True and state()['uploads'] is False
print(json.dumps({'pendingBeforeSwitch': True, 'pendingAEditCancelled': True,
    'recordBUnchangedByA': True, 'hideSwitchShow': True, 'recreatedEditor': True,
    'recordBEditPersisted': True, 'backup': str(backup)}, indent=2))
