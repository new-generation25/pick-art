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
assert.deepStrictEqual(r.action, { kind: 'image', urls: [], plugin: true });
// 카카오 밖 주소는 버림
r = k.parseSkillRequest(base({ action: { params: { secureimage: JSON.stringify({ privacyAgreement: 'Y', secureUrls: 'List(http://evil.example/img.jpg, http://kakaocdn.net.evil.com/a.jpg)' }) } } }));
assert.deepStrictEqual(r.action.urls, []);
// 동의·웰컴·글
const plain = (utt, block) => ({ userRequest: { user: { id: 'u1' }, utterance: utt, block: { name: block } }, action: { params: {}, detailParams: {} } });
assert.strictEqual(k.parseSkillRequest(plain('동의하고 보내기', '제보 동의')).action.kind, 'agree');
assert.strictEqual(k.parseSkillRequest(plain('안녕', '웰컴 블록')).action.kind, 'welcome');
const t = k.parseSkillRequest(plain('극단 해연 «겨울» 12.5~7 김해', '폴백 블록')).action;
assert.strictEqual(t.kind, 'text'); assert.ok(t.text.startsWith('극단 해연'));
// 채팅창에 그냥 보낸 사진(폴백 발화로 주소가 옴, 11/26 운영자 시험)
const T = 'https://talk.kakaocdn.net/dna/bgZY8n/dJMcboYyCIV/abc/i_x.png?credential=a&expires=1&allow_ip=&allow_referer=&signature=b';
let p = k.parseSkillRequest(plain(T, '폴백 블록')).action;
assert.deepStrictEqual(p, { kind: 'image', urls: [T] });
p = k.parseSkillRequest(plain(T + ' ' + T.replace('i_x', 'i_y'), '폴백 블록')).action;
assert.strictEqual(p.kind, 'image'); assert.strictEqual(p.urls.length, 2);
assert.strictEqual(k.parseSkillRequest(plain('포스터 ' + T, '폴백 블록')).action.kind, 'text');   // 글이 섞이면 글
assert.strictEqual(k.parseSkillRequest(plain('https://evil.example/a.png', '폴백 블록')).action.kind, 'text');
assert.strictEqual(k.parseSkillRequest({ userRequest: { user: {} } }), null);
assert.strictEqual(k.parseSkillRequest(null), null);
// 플러그인 사진은 제보 뜻(plugin 표시), 그냥 보낸 사진은 아님
assert.strictEqual(k.parseSkillRequest(base()).action.plugin, true);
assert.ok(!k.parseSkillRequest(plain(T, '폴백 블록')).action.plugin);
// 제보 메뉴(11/26 «제보는 메뉴형태로»)
for (const w of ['행사 알리기', '제보', '리플렛 보내기']) assert.strictEqual(k.parseSkillRequest(plain(w, '폴백 블록')).action.kind, 'tip');
assert.strictEqual(k.parseSkillRequest(plain('주차 되나요?', '폴백 블록')).action.kind, 'text');
assert.strictEqual(k.parseSkillRequest(plain('사진 보내기', '폴백 블록')).action.kind, 'tip');
assert.strictEqual(k.parseSkillRequest(plain('행사 올리고 싶어요', '행사 알리기')).action.kind, 'tip');   // 블록 이름으로
assert.strictEqual(k.parseSkillRequest(plain(T, '행사 알리기')).action.kind, 'image');   // 사진 주소가 먼저
// 웰컴·제보 시간 밖: 상담 연결 버튼 + 행사 알리기 버튼
for (const w of ['운영자에게 문의', '문의', '상담']) assert.strictEqual(k.parseSkillRequest(plain(w, '폴백 블록')).action.kind, 'ask');
assert.strictEqual(k.parseSkillRequest(plain('질문 있어요', '운영자 문의')).action.kind, 'ask');   // 메뉴 블록 이름으로
for (const card of [k.MSG.welcome(), k.MSG.notTip(), k.MSG.ask()]) {
  const tc = card.template.outputs[0].textCard;
  assert.ok(tc.title.length <= 50 && tc.title.length + tc.description.length <= 400, 'textCard 400자');
  assert.deepStrictEqual(tc.buttons.map(b => b.action), ['operator', 'message']);
  assert.strictEqual(tc.buttons[1].messageText, '행사 알리기');
  assert.ok(tc.buttons.every(b => b.label.length <= 14));
}
// 답 모양
const m = k.MSG.consent();
assert.strictEqual(m.version, '2.0'); assert.ok(m.template.outputs.every(o => o.simpleText.text.length <= 1000));
assert.strictEqual(m.template.quickReplies[0].messageText, '동의하고 보내기');
console.log('kakaoSkill tests passed; consent text lengths', m.template.outputs.map(o => o.simpleText.text.length));
