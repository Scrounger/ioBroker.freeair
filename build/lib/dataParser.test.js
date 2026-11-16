import { expect } from 'chai';
import { createCipheriv, createHash } from 'node:crypto';
import { DataParser } from './dataParser';
/**
 * Characterization tests for DataParser.
 *
 * They pin the current observable behavior (return values of parseData / parseControl)
 * so that internal refactorings can be verified. The expected hash was recorded from the
 * implementation before optimization. If a test fails after a change, the behavior changed.
 */
const PASSWORDS = ['0000', '1234567890123456', '123456789012345678901234', '12345678901234567890123456789012'];
const VERSIONS = ['1.2', '1x2', '1x0', '1.10', '2.0', '12x34', '0.5', '1.2.3', '1.x'];
/** Expected SHA-256 over the outputs of all generated cases (see "matches recorded baseline" test). */
const EXPECTED_BASELINE_HASH = '50ca2b7e6d6d0bcf32c827c67a08bebf1a17ad86135ce7b775ef9cb78f7d9f49';
const createAdapter = () => {
    const log = { debug: () => { }, info: () => { }, warn: () => { }, error: () => { } };
    return { log };
};
/** Deterministic PRNG (mulberry32) so that the generated cases are reproducible. */
const createRandom = (seed) => {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};
/** Encrypts a payload the same way the device does (AES-CBC, fixed IV, no padding). */
const encrypt = (plain, password) => {
    const key = Buffer.from(password.padEnd(16, '0'), 'utf8');
    const iv = Buffer.from('000102030405060708090a0b0c0d0e0f', 'hex');
    const cipher = createCipheriv(`aes-${key.length * 8}-cbc`, key, iv);
    cipher.setAutoPadding(false);
    return new Uint8Array(Buffer.concat([cipher.update(Buffer.from(plain)), cipher.final()]));
};
/** Serializes values including undefined, NaN, Infinity and -0, which plain JSON would lose. */
const serialize = (value) => JSON.stringify(value, (_key, v) => {
    if (v === undefined) {
        return '<undefined>';
    }
    if (typeof v === 'number') {
        if (!Number.isFinite(v)) {
            return `<${String(v)}>`;
        }
        if (Object.is(v, -0)) {
            return '<-0>';
        }
    }
    return v;
});
const createPayload = (rnd, length) => {
    const payload = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        payload[i] = Math.floor(rnd() * 256);
    }
    return payload;
};
const filledPayload = (value, length = 48) => new Uint8Array(length).fill(value);
describe('DataParser', () => {
    describe('parseData', () => {
        it('decodes an all-zero payload into the expected values', () => {
            const parser = new DataParser(createAdapter(), 'TEST-SN');
            const result = parser.parseData(encrypt(filledPayload(0), '0000'), 1700000000, '1x2', '0000');
            expect(result).to.not.be.undefined;
            expect(result.timestamp).to.equal(1700000000);
            expect(result.version).to.equal('1.02');
            expect(result.co2).to.equal(0);
            expect(result.operatingModeName).to.equal('Comfort');
        });
        it('decodes an all-0xFF payload into the expected values', () => {
            const parser = new DataParser(createAdapter(), 'TEST-SN');
            const result = parser.parseData(encrypt(filledPayload(0xff), '1234567890123456'), 1700000000, '1.2', '1234567890123456');
            expect(result).to.not.be.undefined;
            expect(result.version).to.equal('1.02');
            expect(result.operatingModeName).to.equal('Dehumidification');
        });
        it('returns undefined when the password length yields an invalid AES key size', () => {
            const parser = new DataParser(createAdapter(), 'TEST-SN');
            const password = '12345678901234567'; // 17 bytes -> AES-136, not supported
            const result = parser.parseData(encrypt(filledPayload(0), '1234567890123456'), 1, '1.2', password);
            expect(result).to.be.undefined;
        });
        it('returns undefined when the encrypted data is not a multiple of the AES block size', () => {
            const parser = new DataParser(createAdapter(), 'TEST-SN');
            const result = parser.parseData(new Uint8Array(50), 1, '1.2', '0000');
            expect(result).to.be.undefined;
        });
    });
    describe('parseControl', () => {
        it('returns only comfortLevel and operatingMode', () => {
            const parser = new DataParser(createAdapter(), 'TEST-SN');
            const result = parser.parseControl(encrypt(filledPayload(0xff), '0000'), 1, '1.2', '0000');
            expect(result).to.not.be.undefined;
            expect(Object.keys(result).sort()).to.deep.equal(['comfortLevel', 'operatingMode']);
        });
        it('returns undefined when decryption is not possible', () => {
            const parser = new DataParser(createAdapter(), 'TEST-SN');
            const result = parser.parseControl(new Uint8Array(50), 1, '1.2', '0000');
            expect(result).to.be.undefined;
        });
    });
    describe('regression baseline', () => {
        it('matches recorded baseline for generated payloads', () => {
            const rnd = createRandom(42);
            const adapter = createAdapter();
            const outputs = [];
            for (let i = 0; i < 400; i++) {
                const password = PASSWORDS[i % PASSWORDS.length];
                const version = VERSIONS[i % VERSIONS.length];
                const length = i % 5 === 0 ? 64 : 48;
                const timestamp = Math.floor(rnd() * 2 ** 31);
                const payload = createPayload(rnd, length);
                const encrypted = encrypt(payload, password);
                const parser = new DataParser(adapter, `SN-${i}`);
                outputs.push(serialize({
                    data: parser.parseData(encrypted, timestamp, version, password),
                    control: parser.parseControl(encrypted, timestamp, version, password),
                }));
            }
            // Edge cases: empty / short payloads (missing bytes -> undefined) and invalid input length
            const parser = new DataParser(adapter, 'SN-edge');
            for (const length of [0, 16, 32]) {
                for (const password of PASSWORDS) {
                    const encrypted = encrypt(createPayload(rnd, length), password);
                    outputs.push(serialize({
                        data: parser.parseData(encrypted, 1, '1.2', password),
                        control: parser.parseControl(encrypted, 1, '1.2', password),
                    }));
                }
            }
            outputs.push(serialize({
                data: parser.parseData(new Uint8Array(47), 1, '1.2', '0000'),
                control: parser.parseControl(new Uint8Array(47), 1, '1.2', '0000'),
            }));
            const hash = createHash('sha256').update(outputs.join('\n')).digest('hex');
            expect(hash).to.equal(EXPECTED_BASELINE_HASH);
        });
    });
});
