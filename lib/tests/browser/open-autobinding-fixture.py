"""Open the agent-browser session wtf260 on the WTF-260 autobinding fixture.
Uses the run-mode login (tippy / tappy, not a secret). See autobinding_test_support.py.
"""
import base64
import json
import subprocess
from autobinding_test_support import PREVIEW, RECORD_A, RECORD_B, VERSION, WORKSPACE, wait_ready

# Reset both disposable records to canonical HTML. Editors normalize markup
# (for example leading spaces), so non-canonical stored HTML can never compare
# equal to the editor's HTML.
for record, html in ((RECORD_A, '<p>Record A</p>'), (RECORD_B, '<p>Record B</p>')):
    subprocess.run(['buildprint', 'data', 'update', 'Doc', record, '--set', f'HTML={html}', '--version', VERSION, '--confirm', '--json'],
                   cwd=WORKSPACE, check=True, capture_output=True)

auth = json.dumps({'Authorization': 'Basic ' + base64.b64encode(b'tippy:tappy').decode()})
subprocess.run(['agent-browser', '--session', 'wtf260', 'open', PREVIEW, '--headers', auth], check=True)
wait_ready()
print(json.dumps({'opened': PREVIEW}))
