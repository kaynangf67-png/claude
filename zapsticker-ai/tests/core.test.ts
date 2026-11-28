import { test } from "node:test";
import assert from "node:assert/strict";
import { unzipSync, strFromU8 } from "fflate";
import { encodeWav, computePeaks } from "../lib/wav.ts";
import { clampTrim, validateAudioFile, validateImageFile, formatDuration, CLIP_MAX_SECONDS } from "../lib/limits.ts";
import { buildStickerPack, slugify } from "../lib/pack.ts";

test("encodeWav escreve cabeçalho RIFF/PCM 16 bits correto", () => {
  const samples = new Float32Array([0, 0.5, -0.5, 1, -1, 2]);
  const buf = encodeWav([samples], 44100);
  const v = new DataView(buf);
  const str = (o: number) => String.fromCharCode(...new Uint8Array(buf, o, 4));
  assert.equal(str(0), "RIFF");
  assert.equal(str(8), "WAVE");
  assert.equal(v.getUint16(22, true), 1);
  assert.equal(v.getUint32(24, true), 44100);
  assert.equal(v.getUint32(40, true), samples.length * 2);
  assert.equal(buf.byteLength, 44 + samples.length * 2);
  assert.equal(v.getInt16(44 + 3 * 2, true), 32767);
  assert.equal(v.getInt16(44 + 5 * 2, true), 32767, "valores > 1 são limitados");
  assert.equal(v.getInt16(44 + 4 * 2, true), -32768);
});

test("computePeaks normaliza para 0…1", () => {
  const p = computePeaks(new Float32Array([0.1, -0.2, 0.4, 0.05]), 2);
  assert.deepEqual(p, [0.5, 1]);
});

test("clampTrim respeita duração, ordem e limite de 30 s", () => {
  assert.deepEqual(clampTrim(2, 1, 10), { start: 1, end: 2 });
  assert.deepEqual(clampTrim(0, 100, 60), { start: 0, end: CLIP_MAX_SECONDS });
  const tiny = clampTrim(5, 5.1, 10);
  assert.ok(tiny.end - tiny.start >= 0.5);
  assert.deepEqual(clampTrim(-3, 4, 3), { start: 0, end: 3 });
});

test("validação de arquivos", () => {
  assert.equal(validateImageFile({ name: "a.jpg", type: "image/jpeg", size: 1000 }), null);
  assert.match(validateImageFile({ name: "a.gif", type: "image/gif", size: 1000 })!, /não suportado/);
  assert.match(validateImageFile({ name: "a.png", type: "image/png", size: 30 * 1024 * 1024 })!, /limite/);
  assert.equal(validateAudioFile({ name: "voz.m4a", type: "", size: 2000 }), null);
  assert.equal(validateAudioFile({ name: "voz.mp3", type: "audio/mpeg", size: 2000 }), null);
  assert.match(validateAudioFile({ name: "doc.pdf", type: "application/pdf", size: 2000 })!, /não suportado/);
});

test("formatDuration", () => {
  assert.equal(formatDuration(3.25), "0:03,3");
  assert.equal(formatDuration(75), "1:15,0");
});

test("pacote .wastickers contém arquivos e contents.json no formato oficial", () => {
  const fake = new Uint8Array([82, 73, 70, 70]);
  const zip = buildStickerPack({
    identifier: "pack_1",
    name: "Meu pacote",
    publisher: "Eu",
    trayPng: fake,
    stickers: [1, 2, 3].map((i) => ({ fileName: `${i}.webp`, webp: fake })),
  });
  const files = unzipSync(zip);
  assert.ok(files["title.txt"] && files["author.txt"] && files["tray.png"]);
  assert.equal(strFromU8(files["title.txt"]), "Meu pacote");
  const contents = JSON.parse(strFromU8(files["contents.json"]));
  const pack = contents.sticker_packs[0];
  assert.equal(pack.identifier, "pack_1");
  assert.equal(pack.tray_image_file, "tray.png");
  assert.equal(pack.stickers.length, 3);
  assert.deepEqual(pack.stickers[0], { image_file: "1.webp", emojis: ["🔊"] });
  assert.throws(() => buildStickerPack({ identifier: "x", name: "a", publisher: "b", trayPng: fake, stickers: [] }), /pelo menos 3/);
});

test("slugify", () => {
  assert.equal(slugify("Bom dia, Vovó!"), "bom-dia-vovo");
  assert.equal(slugify("***"), "figurinha");
});
