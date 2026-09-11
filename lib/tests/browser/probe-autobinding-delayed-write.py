"""Manual fault-injection probe for the proposed 2200ms debounce mitigation.
Requires the disposable WTF-260 fixture in browser session wtf260. Temporarily
holds its first autobinding HTTP request for 5 seconds and types two versions.
Expected to fail with the existing algorithm, even with the longer debounce.
Reload the preview afterward to remove the temporary browser-only wrappers.
"""
import json,subprocess,time,pathlib
BASE=['agent-browser','--session','wtf260','--json']
def browser(*args):
 d=json.loads(subprocess.check_output(BASE+list(args),text=True));assert d['success'],d.get('error');return d['data']
def ev(js):return browser('eval',js).get('result')
assert '/version-33jpy/wtf-260-autobinding' in ev('location.href')
ev('(()=>{const d=document.querySelector("#wtf260-editor").bubble_data.bubble_instance._plugin_data,update=d.updateContent,open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;let held=false;d.updateContent=function(content){const delay=d.delay;d.delay=Math.max(2200,delay||0);try{return update(content)}finally{d.delay=delay}};XMLHttpRequest.prototype.open=function(method,url,...args){this.__wtf260Modify=String(url).includes("elasticsearch/modify");return open.call(this,method,url,...args)};XMLHttpRequest.prototype.send=function(body){if(this.__wtf260Modify&&!held){held=true;setTimeout(()=>send.call(this,body),5000);return}return send.call(this,body)};return true})()')
browser('click','.ProseMirror');browser('press','Control+End')
browser('keyboard','type',' SLOW-OLDER')
time.sleep(2.5)
browser('keyboard','type',' NEWER-MUST-PERSIST')
expected=ev('document.querySelector(".ProseMirror").editor.getHTML()')
time.sleep(7)
actual=ev('document.querySelector("#wtf260-editor").bubble_data.bubble_instance._plugin_data._lastProperties.autobinding')
result={'same':actual==expected,'editorLength':len(expected),'storedLength':len(actual),'expected':expected,'actual':actual}
pathlib.Path('/tmp/wtf260-delayed-write-result.json').write_text(json.dumps(result,indent=2))
print(json.dumps({k:v for k,v in result.items() if k not in ['expected','actual']}),flush=True)
assert actual==expected,'Even 2200ms debounce lost the last save when an earlier request was delayed'
