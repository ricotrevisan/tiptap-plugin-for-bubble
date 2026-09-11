"""Helpers restricted to the disposable WTF-260 Bubble fixture and records."""
import json
import pathlib
import subprocess
import time

PREVIEW = 'https://tiptap-plugin.bubbleapps.io/version-33jpy/wtf-260-autobinding'
RECORD_A = '1789047006074x991054080173902500'
RECORD_B = '1789047009959x299667751052360450'
BASE = ['agent-browser', '--session', 'wtf260', '--json']


def browser(*args):
    result = subprocess.run(BASE + list(args), capture_output=True, text=True, check=True)
    data = json.loads(result.stdout)
    if not data['success']:
        raise RuntimeError(data.get('error'))
    return data['data']


def evaluate(js):
    return browser('eval', js).get('result')


def click(name):
    browser('find', 'role', 'button', 'click', '--name', name, '--exact')


def state():
    return evaluate('''(()=>{
        const i=document.querySelector("#wtf260-editor")?.bubble_data.bubble_instance,d=i?._plugin_data;
        if(!d?.editor_is_ready)return null;
        return {id:d._boundRecordId,html:d.editor.getHTML(),stored:d._lastProperties.autobinding,
            pending:d.hasPendingContent(),saveDelay:d._lastProperties.autobinding_save_delay,
            auto:i.get_static_property("auto_binding"),uploads:i.get_static_property("file_upload_condition")};
    })()''')


def wait_ready(record_id=None):
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        current = state()
        if current and (record_id is None or current['id'] == record_id):
            return
        time.sleep(.1)
    raise AssertionError('Fixture editor did not become ready')


def database_html(record_id):
    assert record_id in (RECORD_A, RECORD_B)
    result = subprocess.run(['buildprint', 'data', 'fetch', record_id, '--app', 'tiptap-plugin',
                             '--version', '33jpy', '--json'], capture_output=True, text=True, check=True)
    data = json.loads(result.stdout)
    assert data['ok'], data
    doc = next(x for x in data['result']['docs'] if x['_id'] == record_id)
    assert doc['found']
    return doc['_source'].get('html_text', '')


def begin(delay):
    assert evaluate('location.href').split('?')[0] == PREVIEW
    browser('reload')
    wait_ready()
    click(f'Delay {delay}')
    click('Record A')
    wait_ready(RECORD_A)
    before = state()
    assert before['id'] == RECORD_A and before['auto'] is True and before['uploads'] is False
    assert before['saveDelay'] == delay
    backup = pathlib.Path('/tmp') / f'wtf260-before-{time.time_ns()}.json'
    backup.write_text(json.dumps({'editor': before, 'database': database_html(RECORD_A), 'recordBDatabase': database_html(RECORD_B)}, indent=2))
    return backup


def network_probe(hold_first_ms=0):
    # Count a held request as outstanding from the moment Bubble submits it.
    # No request bodies, credentials, or response content are captured.
    evaluate('''(()=>{
        const p=window.__wtf260Network={pending:0,requests:[],responses:[]};
        const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.open=function(method,url,...args){
            this.__wtf260Modify=String(url).includes("elasticsearch/modify");
            return open.call(this,method,url,...args);
        };
        XMLHttpRequest.prototype.send=function(body){
            if(!this.__wtf260Modify)return send.call(this,body);
            const index=p.requests.length;
            p.requests.push({index,time:performance.now()});p.pending++;
            this.addEventListener("loadend",()=>{
                p.pending--;p.responses.push({index,time:performance.now(),status:this.status});
            });
            if(index===0&&HOLD>0){setTimeout(()=>send.call(this,body),HOLD);return;}
            return send.call(this,body);
        };
        return true;
    })()'''.replace('HOLD', str(hold_first_ms)))


def wait_settled(expected, record_id=RECORD_A, timeout=20):
    deadline = time.monotonic() + timeout
    stable_since = None
    while time.monotonic() < deadline:
        current = state()
        network = evaluate('window.__wtf260Network || {pending:0,requests:[],responses:[]}')
        matches = (current and current['id'] == record_id and current['html'] == expected
                   and current['stored'] == expected and not current['pending'] and network['pending'] == 0)
        stable_since = (stable_since or time.monotonic()) if matches else None
        if stable_since and time.monotonic() - stable_since >= 1:
            assert all(x['status'] == 200 for x in network['responses']), network
            actual = database_html(record_id)
            assert actual == expected, f'Database did not converge: editor={len(expected)}, database={len(actual)}'
            return network
        time.sleep(.15)
    raise AssertionError(f'Final text did not settle: editor={len(expected)}, state={current}, network={network}')


def reload_and_verify(expected, record_id=RECORD_A):
    browser('reload')
    wait_ready()
    click('Record A' if record_id == RECORD_A else 'Record B')
    wait_ready(record_id)
    current = state()
    assert current['id'] == record_id and current['html'] == expected, current
    assert database_html(record_id) == expected
