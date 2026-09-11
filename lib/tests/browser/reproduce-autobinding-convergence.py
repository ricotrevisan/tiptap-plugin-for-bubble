"""Known failing manual regression: final bound value must match real typing.
Run only on the disposable WTF-260 feature-branch fixture with agent-browser
session wtf260. Leaves the editor open on failure so unsaved text can be inspected.
This is deliberately not included in CI while the save-ordering defect is open.
"""
import json, subprocess, time, pathlib
BASE=['agent-browser','--session','wtf260','--json']
def browser(*args):
 r=subprocess.run(BASE+list(args),capture_output=True,text=True);data=json.loads(r.stdout)
 if not data['success']:raise RuntimeError(data.get('error'))
 return data['data']
def ev(js):return browser('eval',js).get('result')
def state():return ev('(()=>{const d=document.querySelector("#wtf260-editor").bubble_data.bubble_instance._plugin_data;return {html:d.editor.getHTML(),stored:d._lastProperties.autobinding,pending:!!d._pendingContent,delay:d.delay,id:d._boundRecordId}})()')
assert '/version-33jpy/wtf-260-autobinding' in ev('location.href')
browser('find','role','button','click','--name','Delay 0','--exact')
browser('find','role','button','click','--name','Record A','--exact')
time.sleep(.5)
assert state()['id'] == '1789047006074x991054080173902500'
pathlib.Path('/tmp/wtf260-convergence-before.json').write_text(json.dumps(state(),indent=2))
browser('click','.ProseMirror');browser('press','Control+End');browser('press','Enter')
for trial in range(5):
 for burst in range(3):
  browser('keyboard','type',f' [{trial}.{burst}] abcdefghijklmnopqrstuvwxyz ')
  time.sleep(.1)
 expected=state()['html']
 deadline=time.monotonic()+6
 while time.monotonic()<deadline:
  time.sleep(.2);after=state()
  if after['stored']==expected and not after['pending']:break
 time.sleep(.8);after=state()
 result={'trial':trial,'same':after['stored']==expected,'htmlUnchanged':after['html']==expected,'expected':expected,'actual':after}
 pathlib.Path('/tmp/wtf260-convergence-result.json').write_text(json.dumps(result,indent=2))
 print(json.dumps({k:v for k,v in result.items() if k not in ['expected','actual']})+f" editor={len(expected)} stored={len(after['stored'] or '')}",flush=True)
 assert after['stored']==expected, 'Bubble bound value did not converge to final typed document after typing stopped'
 assert after['html']==expected, 'Editor lost text after typing stopped'
