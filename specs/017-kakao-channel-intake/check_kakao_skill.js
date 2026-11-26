// specs/017 kakaoSkill.ts 확인 (저장소에 TS 시험 도구가 없어 typescript 로 옮겨 실행한다)
// 사용: frontend 폴더에서  node ../specs/017-kakao-channel-intake/check_kakao_skill.js <빈 임시 폴더>
const ts = require(require.resolve("typescript", { paths: [process.cwd()] }));
const fs = require('fs'), path = require('path');
const out = process.argv[2];
for (const f of ['leaflets', 'kakaoSkill']) {
  const src = fs.readFileSync(`src/lib/${f}.ts`, 'utf8');
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  fs.writeFileSync(path.join(out, f + '.js'), js);
}
const k = require(path.join(out, 'kakaoSkill.js'));
const assert = require('assert');
const U = 'http://secure.kakaocdn.net/dna/O5UOr/K6auLPnoAf/XXX/img.jpg?credential=Kq0&expires=1542358548&allow_ip=&allow_referer=&signature=fDu%2FJ%3D';
const val = JSON.stringify({ privacyAgreement: 'Y', imageQuantity: '2', secureUrls: `List(${U}, ${U.replace('img.jpg','img2.jpg')})`, expire: 'x' });
const base = (over) => ({ userRequest: { user: { id: 'abc123', type: 'botUserKey', properties: { botUserKey: 'abc123' } }, utterance: '사진 보내기', block: { id: 'b', name: '사진 보내기' } }, action: { params: { secureimage: val }, detailParams: { secureimage: { origin: 'List()', value: val, groupName: '' } } }, ...over });
let r = k.parseSkillRequest(base());
assert.strictEqual(r.action.kind, 'image'); assert.strictEqual(r.action.urls.length, 2); assert.ok(r.action.urls[1].includes('img2.jpg')); assert.strictEqual(r.userKey, 'abc123');
// 한 장, 문서 예시 그대로
r = k.parseSkillRequest(base({ action: { params: { secureimage: JSON.stringify({ privacyAgreement: 'Y', imageQuantity: '1', secureUrls: `List(${U})`, expire: '1970' }) } } }));
assert.deepStrictEqual(r.action.urls, [U]);
// 동의 안 함
r = k.parseSkillRequest(base({ action: { params: { secureimage: JSON.stringify({ privacyAgreement: 'N', secureUrls: `List(${U})` }) } } }));
assert.deepStrictEqual(r.action, { kind: 'image', urls: [] });
// 카카오 밖 주소는 버림
r = k.parseSkillRequest(base({ action: { params: { secureimage: JSON.stringify({ privacyAgreement: 'Y', secureUrls: 'List(http://evil.example/img.jpg, http://kakaocdn.net.evil.com/a.jpg)' }) } } }));
assert.deepStrictEqual(r.action.urls, []);
// 동의·웰컴·글
const plain = (utt, block) => ({ userRequest: { user: { id: 'u1' }, utterance: utt, block: { name: block } }, action: { params: {}, detailParams: {} } });
assert.strictEqual(k.parseSkillRequest(plain('동의하고 보내기', '제보 동의')).action.kind, 'agree');
assert.strictEqual(k.parseSkillRequest(plain('안녕', '웰컴 블록')).action.kind, 'welcome');
const t = k.parseSkillRequest(plain('극단 해연 «겨울» 12.5~7 김해', '폴백 블록')).action;
assert.strictEqual(t.kind, 'text'); assert.ok(t.text.startsWith('극단 해연'));
assert.strictEqual(k.parseSkillRequest({ userRequest: { user: {} } }), null);
assert.strictEqual(k.parseSkillRequest(null), null);
// 답 모양
const m = k.MSG.consent();
assert.strictEqual(m.version, '2.0'); assert.ok(m.template.outputs.every(o => o.simpleText.text.length <= 1000));
assert.strictEqual(m.template.quickReplies[0].messageText, '동의하고 보내기');
console.log('kakaoSkill tests passed; consent text lengths', m.template.outputs.map(o => o.simpleText.text.length));
