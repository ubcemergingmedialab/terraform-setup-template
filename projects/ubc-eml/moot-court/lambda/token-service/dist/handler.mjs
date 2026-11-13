import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);

// handler.mjs
import { randomUUID as randomUUID2 } from "node:crypto";

// node_modules/@bufbuild/protobuf/dist/esm/private/assert.js
function assert(condition, msg) {
  if (!condition) {
    throw new Error(msg);
  }
}
var FLOAT32_MAX = 34028234663852886e22;
var FLOAT32_MIN = -34028234663852886e22;
var UINT32_MAX = 4294967295;
var INT32_MAX = 2147483647;
var INT32_MIN = -2147483648;
function assertInt32(arg) {
  if (typeof arg !== "number")
    throw new Error("invalid int 32: " + typeof arg);
  if (!Number.isInteger(arg) || arg > INT32_MAX || arg < INT32_MIN)
    throw new Error("invalid int 32: " + arg);
}
function assertUInt32(arg) {
  if (typeof arg !== "number")
    throw new Error("invalid uint 32: " + typeof arg);
  if (!Number.isInteger(arg) || arg > UINT32_MAX || arg < 0)
    throw new Error("invalid uint 32: " + arg);
}
function assertFloat32(arg) {
  if (typeof arg !== "number")
    throw new Error("invalid float 32: " + typeof arg);
  if (!Number.isFinite(arg))
    return;
  if (arg > FLOAT32_MAX || arg < FLOAT32_MIN)
    throw new Error("invalid float 32: " + arg);
}

// node_modules/@bufbuild/protobuf/dist/esm/private/enum.js
var enumTypeSymbol = /* @__PURE__ */ Symbol("@bufbuild/protobuf/enum-type");
function getEnumType(enumObject) {
  const t = enumObject[enumTypeSymbol];
  assert(t, "missing enum type on enum object");
  return t;
}
function setEnumType(enumObject, typeName, values, opt) {
  enumObject[enumTypeSymbol] = makeEnumType(typeName, values.map((v) => ({
    no: v.no,
    name: v.name,
    localName: enumObject[v.no]
  })), opt);
}
function makeEnumType(typeName, values, _opt) {
  const names = /* @__PURE__ */ Object.create(null);
  const numbers = /* @__PURE__ */ Object.create(null);
  const normalValues = [];
  for (const value of values) {
    const n = normalizeEnumValue(value);
    normalValues.push(n);
    names[value.name] = n;
    numbers[value.no] = n;
  }
  return {
    typeName,
    values: normalValues,
    // We do not surface options at this time
    // options: opt?.options ?? Object.create(null),
    findName(name) {
      return names[name];
    },
    findNumber(no) {
      return numbers[no];
    }
  };
}
function makeEnum(typeName, values, opt) {
  const enumObject = {};
  for (const value of values) {
    const n = normalizeEnumValue(value);
    enumObject[n.localName] = n.no;
    enumObject[n.no] = n.localName;
  }
  setEnumType(enumObject, typeName, values, opt);
  return enumObject;
}
function normalizeEnumValue(value) {
  if ("localName" in value) {
    return value;
  }
  return Object.assign(Object.assign({}, value), { localName: value.name });
}

// node_modules/@bufbuild/protobuf/dist/esm/message.js
var Message = class {
  /**
   * Compare with a message of the same type.
   * Note that this function disregards extensions and unknown fields.
   */
  equals(other) {
    return this.getType().runtime.util.equals(this.getType(), this, other);
  }
  /**
   * Create a deep copy.
   */
  clone() {
    return this.getType().runtime.util.clone(this);
  }
  /**
   * Parse from binary data, merging fields.
   *
   * Repeated fields are appended. Map entries are added, overwriting
   * existing keys.
   *
   * If a message field is already present, it will be merged with the
   * new data.
   */
  fromBinary(bytes, options) {
    const type = this.getType(), format = type.runtime.bin, opt = format.makeReadOptions(options);
    format.readMessage(this, opt.readerFactory(bytes), bytes.byteLength, opt);
    return this;
  }
  /**
   * Parse a message from a JSON value.
   */
  fromJson(jsonValue, options) {
    const type = this.getType(), format = type.runtime.json, opt = format.makeReadOptions(options);
    format.readMessage(type, jsonValue, opt, this);
    return this;
  }
  /**
   * Parse a message from a JSON string.
   */
  fromJsonString(jsonString, options) {
    let json2;
    try {
      json2 = JSON.parse(jsonString);
    } catch (e) {
      throw new Error(`cannot decode ${this.getType().typeName} from JSON: ${e instanceof Error ? e.message : String(e)}`);
    }
    return this.fromJson(json2, options);
  }
  /**
   * Serialize the message to binary data.
   */
  toBinary(options) {
    const type = this.getType(), bin = type.runtime.bin, opt = bin.makeWriteOptions(options), writer = opt.writerFactory();
    bin.writeMessage(this, writer, opt);
    return writer.finish();
  }
  /**
   * Serialize the message to a JSON value, a JavaScript value that can be
   * passed to JSON.stringify().
   */
  toJson(options) {
    const type = this.getType(), json2 = type.runtime.json, opt = json2.makeWriteOptions(options);
    return json2.writeMessage(this, opt);
  }
  /**
   * Serialize the message to a JSON string.
   */
  toJsonString(options) {
    var _a;
    const value = this.toJson(options);
    return JSON.stringify(value, null, (_a = options === null || options === void 0 ? void 0 : options.prettySpaces) !== null && _a !== void 0 ? _a : 0);
  }
  /**
   * Override for serialization behavior. This will be invoked when calling
   * JSON.stringify on this message (i.e. JSON.stringify(msg)).
   *
   * Note that this will not serialize google.protobuf.Any with a packed
   * message because the protobuf JSON format specifies that it needs to be
   * unpacked, and this is only possible with a type registry to look up the
   * message type.  As a result, attempting to serialize a message with this
   * type will throw an Error.
   *
   * This method is protected because you should not need to invoke it
   * directly -- instead use JSON.stringify or toJsonString for
   * stringified JSON.  Alternatively, if actual JSON is desired, you should
   * use toJson.
   */
  toJSON() {
    return this.toJson({
      emitDefaultValues: true
    });
  }
  /**
   * Retrieve the MessageType of this message - a singleton that represents
   * the protobuf message declaration and provides metadata for reflection-
   * based operations.
   */
  getType() {
    return Object.getPrototypeOf(this).constructor;
  }
};

// node_modules/@bufbuild/protobuf/dist/esm/private/message-type.js
function makeMessageType(runtime, typeName, fields, opt) {
  var _a;
  const localName = (_a = opt === null || opt === void 0 ? void 0 : opt.localName) !== null && _a !== void 0 ? _a : typeName.substring(typeName.lastIndexOf(".") + 1);
  const type = {
    [localName]: function(data) {
      runtime.util.initFields(this);
      runtime.util.initPartial(data, this);
    }
  }[localName];
  Object.setPrototypeOf(type.prototype, new Message());
  Object.assign(type, {
    runtime,
    typeName,
    fields: runtime.util.newFieldList(fields),
    fromBinary(bytes, options) {
      return new type().fromBinary(bytes, options);
    },
    fromJson(jsonValue, options) {
      return new type().fromJson(jsonValue, options);
    },
    fromJsonString(jsonString, options) {
      return new type().fromJsonString(jsonString, options);
    },
    equals(a, b) {
      return runtime.util.equals(type, a, b);
    }
  });
  return type;
}

// node_modules/@bufbuild/protobuf/dist/esm/google/varint.js
function varint64read() {
  let lowBits = 0;
  let highBits = 0;
  for (let shift = 0; shift < 28; shift += 7) {
    let b = this.buf[this.pos++];
    lowBits |= (b & 127) << shift;
    if ((b & 128) == 0) {
      this.assertBounds();
      return [lowBits, highBits];
    }
  }
  let middleByte = this.buf[this.pos++];
  lowBits |= (middleByte & 15) << 28;
  highBits = (middleByte & 112) >> 4;
  if ((middleByte & 128) == 0) {
    this.assertBounds();
    return [lowBits, highBits];
  }
  for (let shift = 3; shift <= 31; shift += 7) {
    let b = this.buf[this.pos++];
    highBits |= (b & 127) << shift;
    if ((b & 128) == 0) {
      this.assertBounds();
      return [lowBits, highBits];
    }
  }
  throw new Error("invalid varint");
}
function varint64write(lo, hi, bytes) {
  for (let i = 0; i < 28; i = i + 7) {
    const shift = lo >>> i;
    const hasNext = !(shift >>> 7 == 0 && hi == 0);
    const byte = (hasNext ? shift | 128 : shift) & 255;
    bytes.push(byte);
    if (!hasNext) {
      return;
    }
  }
  const splitBits = lo >>> 28 & 15 | (hi & 7) << 4;
  const hasMoreBits = !(hi >> 3 == 0);
  bytes.push((hasMoreBits ? splitBits | 128 : splitBits) & 255);
  if (!hasMoreBits) {
    return;
  }
  for (let i = 3; i < 31; i = i + 7) {
    const shift = hi >>> i;
    const hasNext = !(shift >>> 7 == 0);
    const byte = (hasNext ? shift | 128 : shift) & 255;
    bytes.push(byte);
    if (!hasNext) {
      return;
    }
  }
  bytes.push(hi >>> 31 & 1);
}
var TWO_PWR_32_DBL = 4294967296;
function int64FromString(dec) {
  const minus = dec[0] === "-";
  if (minus) {
    dec = dec.slice(1);
  }
  const base = 1e6;
  let lowBits = 0;
  let highBits = 0;
  function add1e6digit(begin, end) {
    const digit1e6 = Number(dec.slice(begin, end));
    highBits *= base;
    lowBits = lowBits * base + digit1e6;
    if (lowBits >= TWO_PWR_32_DBL) {
      highBits = highBits + (lowBits / TWO_PWR_32_DBL | 0);
      lowBits = lowBits % TWO_PWR_32_DBL;
    }
  }
  add1e6digit(-24, -18);
  add1e6digit(-18, -12);
  add1e6digit(-12, -6);
  add1e6digit(-6);
  return minus ? negate(lowBits, highBits) : newBits(lowBits, highBits);
}
function int64ToString(lo, hi) {
  let bits = newBits(lo, hi);
  const negative = bits.hi & 2147483648;
  if (negative) {
    bits = negate(bits.lo, bits.hi);
  }
  const result = uInt64ToString(bits.lo, bits.hi);
  return negative ? "-" + result : result;
}
function uInt64ToString(lo, hi) {
  ({ lo, hi } = toUnsigned(lo, hi));
  if (hi <= 2097151) {
    return String(TWO_PWR_32_DBL * hi + lo);
  }
  const low = lo & 16777215;
  const mid = (lo >>> 24 | hi << 8) & 16777215;
  const high = hi >> 16 & 65535;
  let digitA = low + mid * 6777216 + high * 6710656;
  let digitB = mid + high * 8147497;
  let digitC = high * 2;
  const base = 1e7;
  if (digitA >= base) {
    digitB += Math.floor(digitA / base);
    digitA %= base;
  }
  if (digitB >= base) {
    digitC += Math.floor(digitB / base);
    digitB %= base;
  }
  return digitC.toString() + decimalFrom1e7WithLeadingZeros(digitB) + decimalFrom1e7WithLeadingZeros(digitA);
}
function toUnsigned(lo, hi) {
  return { lo: lo >>> 0, hi: hi >>> 0 };
}
function newBits(lo, hi) {
  return { lo: lo | 0, hi: hi | 0 };
}
function negate(lowBits, highBits) {
  highBits = ~highBits;
  if (lowBits) {
    lowBits = ~lowBits + 1;
  } else {
    highBits += 1;
  }
  return newBits(lowBits, highBits);
}
var decimalFrom1e7WithLeadingZeros = (digit1e7) => {
  const partial = String(digit1e7);
  return "0000000".slice(partial.length) + partial;
};
function varint32write(value, bytes) {
  if (value >= 0) {
    while (value > 127) {
      bytes.push(value & 127 | 128);
      value = value >>> 7;
    }
    bytes.push(value);
  } else {
    for (let i = 0; i < 9; i++) {
      bytes.push(value & 127 | 128);
      value = value >> 7;
    }
    bytes.push(1);
  }
}
function varint32read() {
  let b = this.buf[this.pos++];
  let result = b & 127;
  if ((b & 128) == 0) {
    this.assertBounds();
    return result;
  }
  b = this.buf[this.pos++];
  result |= (b & 127) << 7;
  if ((b & 128) == 0) {
    this.assertBounds();
    return result;
  }
  b = this.buf[this.pos++];
  result |= (b & 127) << 14;
  if ((b & 128) == 0) {
    this.assertBounds();
    return result;
  }
  b = this.buf[this.pos++];
  result |= (b & 127) << 21;
  if ((b & 128) == 0) {
    this.assertBounds();
    return result;
  }
  b = this.buf[this.pos++];
  result |= (b & 15) << 28;
  for (let readBytes = 5; (b & 128) !== 0 && readBytes < 10; readBytes++)
    b = this.buf[this.pos++];
  if ((b & 128) != 0)
    throw new Error("invalid varint");
  this.assertBounds();
  return result >>> 0;
}

// node_modules/@bufbuild/protobuf/dist/esm/proto-int64.js
function makeInt64Support() {
  const dv = new DataView(new ArrayBuffer(8));
  const ok = typeof BigInt === "function" && typeof dv.getBigInt64 === "function" && typeof dv.getBigUint64 === "function" && typeof dv.setBigInt64 === "function" && typeof dv.setBigUint64 === "function" && (typeof process != "object" || typeof process.env != "object" || process.env.BUF_BIGINT_DISABLE !== "1");
  if (ok) {
    const MIN = BigInt("-9223372036854775808"), MAX = BigInt("9223372036854775807"), UMIN = BigInt("0"), UMAX = BigInt("18446744073709551615");
    return {
      zero: BigInt(0),
      supported: true,
      parse(value) {
        const bi = typeof value == "bigint" ? value : BigInt(value);
        if (bi > MAX || bi < MIN) {
          throw new Error(`int64 invalid: ${value}`);
        }
        return bi;
      },
      uParse(value) {
        const bi = typeof value == "bigint" ? value : BigInt(value);
        if (bi > UMAX || bi < UMIN) {
          throw new Error(`uint64 invalid: ${value}`);
        }
        return bi;
      },
      enc(value) {
        dv.setBigInt64(0, this.parse(value), true);
        return {
          lo: dv.getInt32(0, true),
          hi: dv.getInt32(4, true)
        };
      },
      uEnc(value) {
        dv.setBigInt64(0, this.uParse(value), true);
        return {
          lo: dv.getInt32(0, true),
          hi: dv.getInt32(4, true)
        };
      },
      dec(lo, hi) {
        dv.setInt32(0, lo, true);
        dv.setInt32(4, hi, true);
        return dv.getBigInt64(0, true);
      },
      uDec(lo, hi) {
        dv.setInt32(0, lo, true);
        dv.setInt32(4, hi, true);
        return dv.getBigUint64(0, true);
      }
    };
  }
  const assertInt64String = (value) => assert(/^-?[0-9]+$/.test(value), `int64 invalid: ${value}`);
  const assertUInt64String = (value) => assert(/^[0-9]+$/.test(value), `uint64 invalid: ${value}`);
  return {
    zero: "0",
    supported: false,
    parse(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertInt64String(value);
      return value;
    },
    uParse(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertUInt64String(value);
      return value;
    },
    enc(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertInt64String(value);
      return int64FromString(value);
    },
    uEnc(value) {
      if (typeof value != "string") {
        value = value.toString();
      }
      assertUInt64String(value);
      return int64FromString(value);
    },
    dec(lo, hi) {
      return int64ToString(lo, hi);
    },
    uDec(lo, hi) {
      return uInt64ToString(lo, hi);
    }
  };
}
var protoInt64 = makeInt64Support();

// node_modules/@bufbuild/protobuf/dist/esm/scalar.js
var ScalarType;
(function(ScalarType2) {
  ScalarType2[ScalarType2["DOUBLE"] = 1] = "DOUBLE";
  ScalarType2[ScalarType2["FLOAT"] = 2] = "FLOAT";
  ScalarType2[ScalarType2["INT64"] = 3] = "INT64";
  ScalarType2[ScalarType2["UINT64"] = 4] = "UINT64";
  ScalarType2[ScalarType2["INT32"] = 5] = "INT32";
  ScalarType2[ScalarType2["FIXED64"] = 6] = "FIXED64";
  ScalarType2[ScalarType2["FIXED32"] = 7] = "FIXED32";
  ScalarType2[ScalarType2["BOOL"] = 8] = "BOOL";
  ScalarType2[ScalarType2["STRING"] = 9] = "STRING";
  ScalarType2[ScalarType2["BYTES"] = 12] = "BYTES";
  ScalarType2[ScalarType2["UINT32"] = 13] = "UINT32";
  ScalarType2[ScalarType2["SFIXED32"] = 15] = "SFIXED32";
  ScalarType2[ScalarType2["SFIXED64"] = 16] = "SFIXED64";
  ScalarType2[ScalarType2["SINT32"] = 17] = "SINT32";
  ScalarType2[ScalarType2["SINT64"] = 18] = "SINT64";
})(ScalarType || (ScalarType = {}));
var LongType;
(function(LongType2) {
  LongType2[LongType2["BIGINT"] = 0] = "BIGINT";
  LongType2[LongType2["STRING"] = 1] = "STRING";
})(LongType || (LongType = {}));

// node_modules/@bufbuild/protobuf/dist/esm/private/scalars.js
function scalarEquals(type, a, b) {
  if (a === b) {
    return true;
  }
  if (type == ScalarType.BYTES) {
    if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array)) {
      return false;
    }
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }
  switch (type) {
    case ScalarType.UINT64:
    case ScalarType.FIXED64:
    case ScalarType.INT64:
    case ScalarType.SFIXED64:
    case ScalarType.SINT64:
      return a == b;
  }
  return false;
}
function scalarZeroValue(type, longType) {
  switch (type) {
    case ScalarType.BOOL:
      return false;
    case ScalarType.UINT64:
    case ScalarType.FIXED64:
    case ScalarType.INT64:
    case ScalarType.SFIXED64:
    case ScalarType.SINT64:
      return longType == 0 ? protoInt64.zero : "0";
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
      return 0;
    case ScalarType.BYTES:
      return new Uint8Array(0);
    case ScalarType.STRING:
      return "";
    default:
      return 0;
  }
}
function isScalarZeroValue(type, value) {
  switch (type) {
    case ScalarType.BOOL:
      return value === false;
    case ScalarType.STRING:
      return value === "";
    case ScalarType.BYTES:
      return value instanceof Uint8Array && !value.byteLength;
    default:
      return value == 0;
  }
}

// node_modules/@bufbuild/protobuf/dist/esm/binary-encoding.js
var WireType;
(function(WireType2) {
  WireType2[WireType2["Varint"] = 0] = "Varint";
  WireType2[WireType2["Bit64"] = 1] = "Bit64";
  WireType2[WireType2["LengthDelimited"] = 2] = "LengthDelimited";
  WireType2[WireType2["StartGroup"] = 3] = "StartGroup";
  WireType2[WireType2["EndGroup"] = 4] = "EndGroup";
  WireType2[WireType2["Bit32"] = 5] = "Bit32";
})(WireType || (WireType = {}));
var BinaryWriter = class {
  constructor(textEncoder) {
    this.stack = [];
    this.textEncoder = textEncoder !== null && textEncoder !== void 0 ? textEncoder : new TextEncoder();
    this.chunks = [];
    this.buf = [];
  }
  /**
   * Return all bytes written and reset this writer.
   */
  finish() {
    this.chunks.push(new Uint8Array(this.buf));
    let len = 0;
    for (let i = 0; i < this.chunks.length; i++)
      len += this.chunks[i].length;
    let bytes = new Uint8Array(len);
    let offset = 0;
    for (let i = 0; i < this.chunks.length; i++) {
      bytes.set(this.chunks[i], offset);
      offset += this.chunks[i].length;
    }
    this.chunks = [];
    return bytes;
  }
  /**
   * Start a new fork for length-delimited data like a message
   * or a packed repeated field.
   *
   * Must be joined later with `join()`.
   */
  fork() {
    this.stack.push({ chunks: this.chunks, buf: this.buf });
    this.chunks = [];
    this.buf = [];
    return this;
  }
  /**
   * Join the last fork. Write its length and bytes, then
   * return to the previous state.
   */
  join() {
    let chunk = this.finish();
    let prev = this.stack.pop();
    if (!prev)
      throw new Error("invalid state, fork stack empty");
    this.chunks = prev.chunks;
    this.buf = prev.buf;
    this.uint32(chunk.byteLength);
    return this.raw(chunk);
  }
  /**
   * Writes a tag (field number and wire type).
   *
   * Equivalent to `uint32( (fieldNo << 3 | type) >>> 0 )`.
   *
   * Generated code should compute the tag ahead of time and call `uint32()`.
   */
  tag(fieldNo, type) {
    return this.uint32((fieldNo << 3 | type) >>> 0);
  }
  /**
   * Write a chunk of raw bytes.
   */
  raw(chunk) {
    if (this.buf.length) {
      this.chunks.push(new Uint8Array(this.buf));
      this.buf = [];
    }
    this.chunks.push(chunk);
    return this;
  }
  /**
   * Write a `uint32` value, an unsigned 32 bit varint.
   */
  uint32(value) {
    assertUInt32(value);
    while (value > 127) {
      this.buf.push(value & 127 | 128);
      value = value >>> 7;
    }
    this.buf.push(value);
    return this;
  }
  /**
   * Write a `int32` value, a signed 32 bit varint.
   */
  int32(value) {
    assertInt32(value);
    varint32write(value, this.buf);
    return this;
  }
  /**
   * Write a `bool` value, a variant.
   */
  bool(value) {
    this.buf.push(value ? 1 : 0);
    return this;
  }
  /**
   * Write a `bytes` value, length-delimited arbitrary data.
   */
  bytes(value) {
    this.uint32(value.byteLength);
    return this.raw(value);
  }
  /**
   * Write a `string` value, length-delimited data converted to UTF-8 text.
   */
  string(value) {
    let chunk = this.textEncoder.encode(value);
    this.uint32(chunk.byteLength);
    return this.raw(chunk);
  }
  /**
   * Write a `float` value, 32-bit floating point number.
   */
  float(value) {
    assertFloat32(value);
    let chunk = new Uint8Array(4);
    new DataView(chunk.buffer).setFloat32(0, value, true);
    return this.raw(chunk);
  }
  /**
   * Write a `double` value, a 64-bit floating point number.
   */
  double(value) {
    let chunk = new Uint8Array(8);
    new DataView(chunk.buffer).setFloat64(0, value, true);
    return this.raw(chunk);
  }
  /**
   * Write a `fixed32` value, an unsigned, fixed-length 32-bit integer.
   */
  fixed32(value) {
    assertUInt32(value);
    let chunk = new Uint8Array(4);
    new DataView(chunk.buffer).setUint32(0, value, true);
    return this.raw(chunk);
  }
  /**
   * Write a `sfixed32` value, a signed, fixed-length 32-bit integer.
   */
  sfixed32(value) {
    assertInt32(value);
    let chunk = new Uint8Array(4);
    new DataView(chunk.buffer).setInt32(0, value, true);
    return this.raw(chunk);
  }
  /**
   * Write a `sint32` value, a signed, zigzag-encoded 32-bit varint.
   */
  sint32(value) {
    assertInt32(value);
    value = (value << 1 ^ value >> 31) >>> 0;
    varint32write(value, this.buf);
    return this;
  }
  /**
   * Write a `fixed64` value, a signed, fixed-length 64-bit integer.
   */
  sfixed64(value) {
    let chunk = new Uint8Array(8), view = new DataView(chunk.buffer), tc = protoInt64.enc(value);
    view.setInt32(0, tc.lo, true);
    view.setInt32(4, tc.hi, true);
    return this.raw(chunk);
  }
  /**
   * Write a `fixed64` value, an unsigned, fixed-length 64 bit integer.
   */
  fixed64(value) {
    let chunk = new Uint8Array(8), view = new DataView(chunk.buffer), tc = protoInt64.uEnc(value);
    view.setInt32(0, tc.lo, true);
    view.setInt32(4, tc.hi, true);
    return this.raw(chunk);
  }
  /**
   * Write a `int64` value, a signed 64-bit varint.
   */
  int64(value) {
    let tc = protoInt64.enc(value);
    varint64write(tc.lo, tc.hi, this.buf);
    return this;
  }
  /**
   * Write a `sint64` value, a signed, zig-zag-encoded 64-bit varint.
   */
  sint64(value) {
    let tc = protoInt64.enc(value), sign3 = tc.hi >> 31, lo = tc.lo << 1 ^ sign3, hi = (tc.hi << 1 | tc.lo >>> 31) ^ sign3;
    varint64write(lo, hi, this.buf);
    return this;
  }
  /**
   * Write a `uint64` value, an unsigned 64-bit varint.
   */
  uint64(value) {
    let tc = protoInt64.uEnc(value);
    varint64write(tc.lo, tc.hi, this.buf);
    return this;
  }
};
var BinaryReader = class {
  constructor(buf, textDecoder) {
    this.varint64 = varint64read;
    this.uint32 = varint32read;
    this.buf = buf;
    this.len = buf.length;
    this.pos = 0;
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    this.textDecoder = textDecoder !== null && textDecoder !== void 0 ? textDecoder : new TextDecoder();
  }
  /**
   * Reads a tag - field number and wire type.
   */
  tag() {
    let tag2 = this.uint32(), fieldNo = tag2 >>> 3, wireType = tag2 & 7;
    if (fieldNo <= 0 || wireType < 0 || wireType > 5)
      throw new Error("illegal tag: field no " + fieldNo + " wire type " + wireType);
    return [fieldNo, wireType];
  }
  /**
   * Skip one element and return the skipped data.
   *
   * When skipping StartGroup, provide the tags field number to check for
   * matching field number in the EndGroup tag.
   */
  skip(wireType, fieldNo) {
    let start = this.pos;
    switch (wireType) {
      case WireType.Varint:
        while (this.buf[this.pos++] & 128) {
        }
        break;
      // eslint-disable-next-line
      // @ts-ignore TS7029: Fallthrough case in switch
      case WireType.Bit64:
        this.pos += 4;
      // eslint-disable-next-line
      // @ts-ignore TS7029: Fallthrough case in switch
      case WireType.Bit32:
        this.pos += 4;
        break;
      case WireType.LengthDelimited:
        let len = this.uint32();
        this.pos += len;
        break;
      case WireType.StartGroup:
        for (; ; ) {
          const [fn, wt] = this.tag();
          if (wt === WireType.EndGroup) {
            if (fieldNo !== void 0 && fn !== fieldNo) {
              throw new Error("invalid end group tag");
            }
            break;
          }
          this.skip(wt, fn);
        }
        break;
      default:
        throw new Error("cant skip wire type " + wireType);
    }
    this.assertBounds();
    return this.buf.subarray(start, this.pos);
  }
  /**
   * Throws error if position in byte array is out of range.
   */
  assertBounds() {
    if (this.pos > this.len)
      throw new RangeError("premature EOF");
  }
  /**
   * Read a `int32` field, a signed 32 bit varint.
   */
  int32() {
    return this.uint32() | 0;
  }
  /**
   * Read a `sint32` field, a signed, zigzag-encoded 32-bit varint.
   */
  sint32() {
    let zze = this.uint32();
    return zze >>> 1 ^ -(zze & 1);
  }
  /**
   * Read a `int64` field, a signed 64-bit varint.
   */
  int64() {
    return protoInt64.dec(...this.varint64());
  }
  /**
   * Read a `uint64` field, an unsigned 64-bit varint.
   */
  uint64() {
    return protoInt64.uDec(...this.varint64());
  }
  /**
   * Read a `sint64` field, a signed, zig-zag-encoded 64-bit varint.
   */
  sint64() {
    let [lo, hi] = this.varint64();
    let s = -(lo & 1);
    lo = (lo >>> 1 | (hi & 1) << 31) ^ s;
    hi = hi >>> 1 ^ s;
    return protoInt64.dec(lo, hi);
  }
  /**
   * Read a `bool` field, a variant.
   */
  bool() {
    let [lo, hi] = this.varint64();
    return lo !== 0 || hi !== 0;
  }
  /**
   * Read a `fixed32` field, an unsigned, fixed-length 32-bit integer.
   */
  fixed32() {
    return this.view.getUint32((this.pos += 4) - 4, true);
  }
  /**
   * Read a `sfixed32` field, a signed, fixed-length 32-bit integer.
   */
  sfixed32() {
    return this.view.getInt32((this.pos += 4) - 4, true);
  }
  /**
   * Read a `fixed64` field, an unsigned, fixed-length 64 bit integer.
   */
  fixed64() {
    return protoInt64.uDec(this.sfixed32(), this.sfixed32());
  }
  /**
   * Read a `fixed64` field, a signed, fixed-length 64-bit integer.
   */
  sfixed64() {
    return protoInt64.dec(this.sfixed32(), this.sfixed32());
  }
  /**
   * Read a `float` field, 32-bit floating point number.
   */
  float() {
    return this.view.getFloat32((this.pos += 4) - 4, true);
  }
  /**
   * Read a `double` field, a 64-bit floating point number.
   */
  double() {
    return this.view.getFloat64((this.pos += 8) - 8, true);
  }
  /**
   * Read a `bytes` field, length-delimited arbitrary data.
   */
  bytes() {
    let len = this.uint32(), start = this.pos;
    this.pos += len;
    this.assertBounds();
    return this.buf.subarray(start, start + len);
  }
  /**
   * Read a `string` field, length-delimited data converted to UTF-8 text.
   */
  string() {
    return this.textDecoder.decode(this.bytes());
  }
};

// node_modules/@bufbuild/protobuf/dist/esm/private/extensions.js
function makeExtension(runtime, typeName, extendee, field) {
  let fi;
  return {
    typeName,
    extendee,
    get field() {
      if (!fi) {
        const i = typeof field == "function" ? field() : field;
        i.name = typeName.split(".").pop();
        i.jsonName = `[${typeName}]`;
        fi = runtime.util.newFieldList([i]).list()[0];
      }
      return fi;
    },
    runtime
  };
}
function createExtensionContainer(extension) {
  const localName = extension.field.localName;
  const container = /* @__PURE__ */ Object.create(null);
  container[localName] = initExtensionField(extension);
  return [container, () => container[localName]];
}
function initExtensionField(ext) {
  const field = ext.field;
  if (field.repeated) {
    return [];
  }
  if (field.default !== void 0) {
    return field.default;
  }
  switch (field.kind) {
    case "enum":
      return field.T.values[0].no;
    case "scalar":
      return scalarZeroValue(field.T, field.L);
    case "message":
      const T = field.T, value = new T();
      return T.fieldWrapper ? T.fieldWrapper.unwrapField(value) : value;
    case "map":
      throw "map fields are not allowed to be extensions";
  }
}
function filterUnknownFields(unknownFields, field) {
  if (!field.repeated && (field.kind == "enum" || field.kind == "scalar")) {
    for (let i = unknownFields.length - 1; i >= 0; --i) {
      if (unknownFields[i].no == field.no) {
        return [unknownFields[i]];
      }
    }
    return [];
  }
  return unknownFields.filter((uf) => uf.no === field.no);
}

// node_modules/@bufbuild/protobuf/dist/esm/proto-base64.js
var encTable = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");
var decTable = [];
for (let i = 0; i < encTable.length; i++)
  decTable[encTable[i].charCodeAt(0)] = i;
decTable["-".charCodeAt(0)] = encTable.indexOf("+");
decTable["_".charCodeAt(0)] = encTable.indexOf("/");
var protoBase64 = {
  /**
   * Decodes a base64 string to a byte array.
   *
   * - ignores white-space, including line breaks and tabs
   * - allows inner padding (can decode concatenated base64 strings)
   * - does not require padding
   * - understands base64url encoding:
   *   "-" instead of "+",
   *   "_" instead of "/",
   *   no padding
   */
  dec(base64Str) {
    let es = base64Str.length * 3 / 4;
    if (base64Str[base64Str.length - 2] == "=")
      es -= 2;
    else if (base64Str[base64Str.length - 1] == "=")
      es -= 1;
    let bytes = new Uint8Array(es), bytePos = 0, groupPos = 0, b, p = 0;
    for (let i = 0; i < base64Str.length; i++) {
      b = decTable[base64Str.charCodeAt(i)];
      if (b === void 0) {
        switch (base64Str[i]) {
          // @ts-ignore TS7029: Fallthrough case in switch
          case "=":
            groupPos = 0;
          // reset state when padding found
          // @ts-ignore TS7029: Fallthrough case in switch
          case "\n":
          case "\r":
          case "	":
          case " ":
            continue;
          // skip white-space, and padding
          default:
            throw Error("invalid base64 string.");
        }
      }
      switch (groupPos) {
        case 0:
          p = b;
          groupPos = 1;
          break;
        case 1:
          bytes[bytePos++] = p << 2 | (b & 48) >> 4;
          p = b;
          groupPos = 2;
          break;
        case 2:
          bytes[bytePos++] = (p & 15) << 4 | (b & 60) >> 2;
          p = b;
          groupPos = 3;
          break;
        case 3:
          bytes[bytePos++] = (p & 3) << 6 | b;
          groupPos = 0;
          break;
      }
    }
    if (groupPos == 1)
      throw Error("invalid base64 string.");
    return bytes.subarray(0, bytePos);
  },
  /**
   * Encode a byte array to a base64 string.
   */
  enc(bytes) {
    let base64 = "", groupPos = 0, b, p = 0;
    for (let i = 0; i < bytes.length; i++) {
      b = bytes[i];
      switch (groupPos) {
        case 0:
          base64 += encTable[b >> 2];
          p = (b & 3) << 4;
          groupPos = 1;
          break;
        case 1:
          base64 += encTable[p | b >> 4];
          p = (b & 15) << 2;
          groupPos = 2;
          break;
        case 2:
          base64 += encTable[p | b >> 6];
          base64 += encTable[b & 63];
          groupPos = 0;
          break;
      }
    }
    if (groupPos) {
      base64 += encTable[p];
      base64 += "=";
      if (groupPos == 1)
        base64 += "=";
    }
    return base64;
  }
};

// node_modules/@bufbuild/protobuf/dist/esm/extension-accessor.js
function getExtension(message2, extension, options) {
  assertExtendee(extension, message2);
  const opt = extension.runtime.bin.makeReadOptions(options);
  const ufs = filterUnknownFields(message2.getType().runtime.bin.listUnknownFields(message2), extension.field);
  const [container, get] = createExtensionContainer(extension);
  for (const uf of ufs) {
    extension.runtime.bin.readField(container, opt.readerFactory(uf.data), extension.field, uf.wireType, opt);
  }
  return get();
}
function setExtension(message2, extension, value, options) {
  assertExtendee(extension, message2);
  const readOpt = extension.runtime.bin.makeReadOptions(options);
  const writeOpt = extension.runtime.bin.makeWriteOptions(options);
  if (hasExtension(message2, extension)) {
    const ufs = message2.getType().runtime.bin.listUnknownFields(message2).filter((uf) => uf.no != extension.field.no);
    message2.getType().runtime.bin.discardUnknownFields(message2);
    for (const uf of ufs) {
      message2.getType().runtime.bin.onUnknownField(message2, uf.no, uf.wireType, uf.data);
    }
  }
  const writer = writeOpt.writerFactory();
  let f = extension.field;
  if (!f.opt && !f.repeated && (f.kind == "enum" || f.kind == "scalar")) {
    f = Object.assign(Object.assign({}, extension.field), { opt: true });
  }
  extension.runtime.bin.writeField(f, value, writer, writeOpt);
  const reader = readOpt.readerFactory(writer.finish());
  while (reader.pos < reader.len) {
    const [no, wireType] = reader.tag();
    const data = reader.skip(wireType, no);
    message2.getType().runtime.bin.onUnknownField(message2, no, wireType, data);
  }
}
function hasExtension(message2, extension) {
  const messageType = message2.getType();
  return extension.extendee.typeName === messageType.typeName && !!messageType.runtime.bin.listUnknownFields(message2).find((uf) => uf.no == extension.field.no);
}
function assertExtendee(extension, message2) {
  assert(extension.extendee.typeName == message2.getType().typeName, `extension ${extension.typeName} can only be applied to message ${extension.extendee.typeName}`);
}

// node_modules/@bufbuild/protobuf/dist/esm/private/reflect.js
function isFieldSet(field, target) {
  const localName = field.localName;
  if (field.repeated) {
    return target[localName].length > 0;
  }
  if (field.oneof) {
    return target[field.oneof.localName].case === localName;
  }
  switch (field.kind) {
    case "enum":
    case "scalar":
      if (field.opt || field.req) {
        return target[localName] !== void 0;
      }
      if (field.kind == "enum") {
        return target[localName] !== field.T.values[0].no;
      }
      return !isScalarZeroValue(field.T, target[localName]);
    case "message":
      return target[localName] !== void 0;
    case "map":
      return Object.keys(target[localName]).length > 0;
  }
}
function clearField(field, target) {
  const localName = field.localName;
  const implicitPresence = !field.opt && !field.req;
  if (field.repeated) {
    target[localName] = [];
  } else if (field.oneof) {
    target[field.oneof.localName] = { case: void 0 };
  } else {
    switch (field.kind) {
      case "map":
        target[localName] = {};
        break;
      case "enum":
        target[localName] = implicitPresence ? field.T.values[0].no : void 0;
        break;
      case "scalar":
        target[localName] = implicitPresence ? scalarZeroValue(field.T, field.L) : void 0;
        break;
      case "message":
        target[localName] = void 0;
        break;
    }
  }
}

// node_modules/@bufbuild/protobuf/dist/esm/is-message.js
function isMessage(arg, type) {
  if (arg === null || typeof arg != "object") {
    return false;
  }
  if (!Object.getOwnPropertyNames(Message.prototype).every((m) => m in arg && typeof arg[m] == "function")) {
    return false;
  }
  const actualType = arg.getType();
  if (actualType === null || typeof actualType != "function" || !("typeName" in actualType) || typeof actualType.typeName != "string") {
    return false;
  }
  return type === void 0 ? true : actualType.typeName == type.typeName;
}

// node_modules/@bufbuild/protobuf/dist/esm/private/field-wrapper.js
function wrapField(type, value) {
  if (isMessage(value) || !type.fieldWrapper) {
    return value;
  }
  return type.fieldWrapper.wrapField(value);
}
var wktWrapperToScalarType = {
  "google.protobuf.DoubleValue": ScalarType.DOUBLE,
  "google.protobuf.FloatValue": ScalarType.FLOAT,
  "google.protobuf.Int64Value": ScalarType.INT64,
  "google.protobuf.UInt64Value": ScalarType.UINT64,
  "google.protobuf.Int32Value": ScalarType.INT32,
  "google.protobuf.UInt32Value": ScalarType.UINT32,
  "google.protobuf.BoolValue": ScalarType.BOOL,
  "google.protobuf.StringValue": ScalarType.STRING,
  "google.protobuf.BytesValue": ScalarType.BYTES
};

// node_modules/@bufbuild/protobuf/dist/esm/private/json-format.js
var jsonReadDefaults = {
  ignoreUnknownFields: false
};
var jsonWriteDefaults = {
  emitDefaultValues: false,
  enumAsInteger: false,
  useProtoFieldName: false,
  prettySpaces: 0
};
function makeReadOptions(options) {
  return options ? Object.assign(Object.assign({}, jsonReadDefaults), options) : jsonReadDefaults;
}
function makeWriteOptions(options) {
  return options ? Object.assign(Object.assign({}, jsonWriteDefaults), options) : jsonWriteDefaults;
}
var tokenNull = /* @__PURE__ */ Symbol();
var tokenIgnoredUnknownEnum = /* @__PURE__ */ Symbol();
function makeJsonFormat() {
  return {
    makeReadOptions,
    makeWriteOptions,
    readMessage(type, json2, options, message2) {
      if (json2 == null || Array.isArray(json2) || typeof json2 != "object") {
        throw new Error(`cannot decode message ${type.typeName} from JSON: ${debugJsonValue(json2)}`);
      }
      message2 = message2 !== null && message2 !== void 0 ? message2 : new type();
      const oneofSeen = /* @__PURE__ */ new Map();
      const registry = options.typeRegistry;
      for (const [jsonKey, jsonValue] of Object.entries(json2)) {
        const field = type.fields.findJsonName(jsonKey);
        if (field) {
          if (field.oneof) {
            if (jsonValue === null && field.kind == "scalar") {
              continue;
            }
            const seen = oneofSeen.get(field.oneof);
            if (seen !== void 0) {
              throw new Error(`cannot decode message ${type.typeName} from JSON: multiple keys for oneof "${field.oneof.name}" present: "${seen}", "${jsonKey}"`);
            }
            oneofSeen.set(field.oneof, jsonKey);
          }
          readField(message2, jsonValue, field, options, type);
        } else {
          let found = false;
          if ((registry === null || registry === void 0 ? void 0 : registry.findExtension) && jsonKey.startsWith("[") && jsonKey.endsWith("]")) {
            const ext = registry.findExtension(jsonKey.substring(1, jsonKey.length - 1));
            if (ext && ext.extendee.typeName == type.typeName) {
              found = true;
              const [container, get] = createExtensionContainer(ext);
              readField(container, jsonValue, ext.field, options, ext);
              setExtension(message2, ext, get(), options);
            }
          }
          if (!found && !options.ignoreUnknownFields) {
            throw new Error(`cannot decode message ${type.typeName} from JSON: key "${jsonKey}" is unknown`);
          }
        }
      }
      return message2;
    },
    writeMessage(message2, options) {
      const type = message2.getType();
      const json2 = {};
      let field;
      try {
        for (field of type.fields.byNumber()) {
          if (!isFieldSet(field, message2)) {
            if (field.req) {
              throw `required field not set`;
            }
            if (!options.emitDefaultValues) {
              continue;
            }
            if (!canEmitFieldDefaultValue(field)) {
              continue;
            }
          }
          const value = field.oneof ? message2[field.oneof.localName].value : message2[field.localName];
          const jsonValue = writeField(field, value, options);
          if (jsonValue !== void 0) {
            json2[options.useProtoFieldName ? field.name : field.jsonName] = jsonValue;
          }
        }
        const registry = options.typeRegistry;
        if (registry === null || registry === void 0 ? void 0 : registry.findExtensionFor) {
          for (const uf of type.runtime.bin.listUnknownFields(message2)) {
            const ext = registry.findExtensionFor(type.typeName, uf.no);
            if (ext && hasExtension(message2, ext)) {
              const value = getExtension(message2, ext, options);
              const jsonValue = writeField(ext.field, value, options);
              if (jsonValue !== void 0) {
                json2[ext.field.jsonName] = jsonValue;
              }
            }
          }
        }
      } catch (e) {
        const m = field ? `cannot encode field ${type.typeName}.${field.name} to JSON` : `cannot encode message ${type.typeName} to JSON`;
        const r = e instanceof Error ? e.message : String(e);
        throw new Error(m + (r.length > 0 ? `: ${r}` : ""));
      }
      return json2;
    },
    readScalar(type, json2, longType) {
      return readScalar(type, json2, longType !== null && longType !== void 0 ? longType : LongType.BIGINT, true);
    },
    writeScalar(type, value, emitDefaultValues) {
      if (value === void 0) {
        return void 0;
      }
      if (emitDefaultValues || isScalarZeroValue(type, value)) {
        return writeScalar(type, value);
      }
      return void 0;
    },
    debug: debugJsonValue
  };
}
function debugJsonValue(json2) {
  if (json2 === null) {
    return "null";
  }
  switch (typeof json2) {
    case "object":
      return Array.isArray(json2) ? "array" : "object";
    case "string":
      return json2.length > 100 ? "string" : `"${json2.split('"').join('\\"')}"`;
    default:
      return String(json2);
  }
}
function readField(target, jsonValue, field, options, parentType) {
  let localName = field.localName;
  if (field.repeated) {
    assert(field.kind != "map");
    if (jsonValue === null) {
      return;
    }
    if (!Array.isArray(jsonValue)) {
      throw new Error(`cannot decode field ${parentType.typeName}.${field.name} from JSON: ${debugJsonValue(jsonValue)}`);
    }
    const targetArray = target[localName];
    for (const jsonItem of jsonValue) {
      if (jsonItem === null) {
        throw new Error(`cannot decode field ${parentType.typeName}.${field.name} from JSON: ${debugJsonValue(jsonItem)}`);
      }
      switch (field.kind) {
        case "message":
          targetArray.push(field.T.fromJson(jsonItem, options));
          break;
        case "enum":
          const enumValue = readEnum(field.T, jsonItem, options.ignoreUnknownFields, true);
          if (enumValue !== tokenIgnoredUnknownEnum) {
            targetArray.push(enumValue);
          }
          break;
        case "scalar":
          try {
            targetArray.push(readScalar(field.T, jsonItem, field.L, true));
          } catch (e) {
            let m = `cannot decode field ${parentType.typeName}.${field.name} from JSON: ${debugJsonValue(jsonItem)}`;
            if (e instanceof Error && e.message.length > 0) {
              m += `: ${e.message}`;
            }
            throw new Error(m);
          }
          break;
      }
    }
  } else if (field.kind == "map") {
    if (jsonValue === null) {
      return;
    }
    if (typeof jsonValue != "object" || Array.isArray(jsonValue)) {
      throw new Error(`cannot decode field ${parentType.typeName}.${field.name} from JSON: ${debugJsonValue(jsonValue)}`);
    }
    const targetMap = target[localName];
    for (const [jsonMapKey, jsonMapValue] of Object.entries(jsonValue)) {
      if (jsonMapValue === null) {
        throw new Error(`cannot decode field ${parentType.typeName}.${field.name} from JSON: map value null`);
      }
      let key;
      try {
        key = readMapKey(field.K, jsonMapKey);
      } catch (e) {
        let m = `cannot decode map key for field ${parentType.typeName}.${field.name} from JSON: ${debugJsonValue(jsonValue)}`;
        if (e instanceof Error && e.message.length > 0) {
          m += `: ${e.message}`;
        }
        throw new Error(m);
      }
      switch (field.V.kind) {
        case "message":
          targetMap[key] = field.V.T.fromJson(jsonMapValue, options);
          break;
        case "enum":
          const enumValue = readEnum(field.V.T, jsonMapValue, options.ignoreUnknownFields, true);
          if (enumValue !== tokenIgnoredUnknownEnum) {
            targetMap[key] = enumValue;
          }
          break;
        case "scalar":
          try {
            targetMap[key] = readScalar(field.V.T, jsonMapValue, LongType.BIGINT, true);
          } catch (e) {
            let m = `cannot decode map value for field ${parentType.typeName}.${field.name} from JSON: ${debugJsonValue(jsonValue)}`;
            if (e instanceof Error && e.message.length > 0) {
              m += `: ${e.message}`;
            }
            throw new Error(m);
          }
          break;
      }
    }
  } else {
    if (field.oneof) {
      target = target[field.oneof.localName] = { case: localName };
      localName = "value";
    }
    switch (field.kind) {
      case "message":
        const messageType = field.T;
        if (jsonValue === null && messageType.typeName != "google.protobuf.Value") {
          return;
        }
        let currentValue = target[localName];
        if (isMessage(currentValue)) {
          currentValue.fromJson(jsonValue, options);
        } else {
          target[localName] = currentValue = messageType.fromJson(jsonValue, options);
          if (messageType.fieldWrapper && !field.oneof) {
            target[localName] = messageType.fieldWrapper.unwrapField(currentValue);
          }
        }
        break;
      case "enum":
        const enumValue = readEnum(field.T, jsonValue, options.ignoreUnknownFields, false);
        switch (enumValue) {
          case tokenNull:
            clearField(field, target);
            break;
          case tokenIgnoredUnknownEnum:
            break;
          default:
            target[localName] = enumValue;
            break;
        }
        break;
      case "scalar":
        try {
          const scalarValue = readScalar(field.T, jsonValue, field.L, false);
          switch (scalarValue) {
            case tokenNull:
              clearField(field, target);
              break;
            default:
              target[localName] = scalarValue;
              break;
          }
        } catch (e) {
          let m = `cannot decode field ${parentType.typeName}.${field.name} from JSON: ${debugJsonValue(jsonValue)}`;
          if (e instanceof Error && e.message.length > 0) {
            m += `: ${e.message}`;
          }
          throw new Error(m);
        }
        break;
    }
  }
}
function readMapKey(type, json2) {
  if (type === ScalarType.BOOL) {
    switch (json2) {
      case "true":
        json2 = true;
        break;
      case "false":
        json2 = false;
        break;
    }
  }
  return readScalar(type, json2, LongType.BIGINT, true).toString();
}
function readScalar(type, json2, longType, nullAsZeroValue) {
  if (json2 === null) {
    if (nullAsZeroValue) {
      return scalarZeroValue(type, longType);
    }
    return tokenNull;
  }
  switch (type) {
    // float, double: JSON value will be a number or one of the special string values "NaN", "Infinity", and "-Infinity".
    // Either numbers or strings are accepted. Exponent notation is also accepted.
    case ScalarType.DOUBLE:
    case ScalarType.FLOAT:
      if (json2 === "NaN")
        return Number.NaN;
      if (json2 === "Infinity")
        return Number.POSITIVE_INFINITY;
      if (json2 === "-Infinity")
        return Number.NEGATIVE_INFINITY;
      if (json2 === "") {
        break;
      }
      if (typeof json2 == "string" && json2.trim().length !== json2.length) {
        break;
      }
      if (typeof json2 != "string" && typeof json2 != "number") {
        break;
      }
      const float = Number(json2);
      if (Number.isNaN(float)) {
        break;
      }
      if (!Number.isFinite(float)) {
        break;
      }
      if (type == ScalarType.FLOAT)
        assertFloat32(float);
      return float;
    // int32, fixed32, uint32: JSON value will be a decimal number. Either numbers or strings are accepted.
    case ScalarType.INT32:
    case ScalarType.FIXED32:
    case ScalarType.SFIXED32:
    case ScalarType.SINT32:
    case ScalarType.UINT32:
      let int32;
      if (typeof json2 == "number")
        int32 = json2;
      else if (typeof json2 == "string" && json2.length > 0) {
        if (json2.trim().length === json2.length)
          int32 = Number(json2);
      }
      if (int32 === void 0)
        break;
      if (type == ScalarType.UINT32 || type == ScalarType.FIXED32)
        assertUInt32(int32);
      else
        assertInt32(int32);
      return int32;
    // int64, fixed64, uint64: JSON value will be a decimal string. Either numbers or strings are accepted.
    case ScalarType.INT64:
    case ScalarType.SFIXED64:
    case ScalarType.SINT64:
      if (typeof json2 != "number" && typeof json2 != "string")
        break;
      const long = protoInt64.parse(json2);
      return longType ? long.toString() : long;
    case ScalarType.FIXED64:
    case ScalarType.UINT64:
      if (typeof json2 != "number" && typeof json2 != "string")
        break;
      const uLong = protoInt64.uParse(json2);
      return longType ? uLong.toString() : uLong;
    // bool:
    case ScalarType.BOOL:
      if (typeof json2 !== "boolean")
        break;
      return json2;
    // string:
    case ScalarType.STRING:
      if (typeof json2 !== "string") {
        break;
      }
      try {
        encodeURIComponent(json2);
      } catch (e) {
        throw new Error("invalid UTF8");
      }
      return json2;
    // bytes: JSON value will be the data encoded as a string using standard base64 encoding with paddings.
    // Either standard or URL-safe base64 encoding with/without paddings are accepted.
    case ScalarType.BYTES:
      if (json2 === "")
        return new Uint8Array(0);
      if (typeof json2 !== "string")
        break;
      return protoBase64.dec(json2);
  }
  throw new Error();
}
function readEnum(type, json2, ignoreUnknownFields, nullAsZeroValue) {
  if (json2 === null) {
    if (type.typeName == "google.protobuf.NullValue") {
      return 0;
    }
    return nullAsZeroValue ? type.values[0].no : tokenNull;
  }
  switch (typeof json2) {
    case "number":
      if (Number.isInteger(json2)) {
        return json2;
      }
      break;
    case "string":
      const value = type.findName(json2);
      if (value !== void 0) {
        return value.no;
      }
      if (ignoreUnknownFields) {
        return tokenIgnoredUnknownEnum;
      }
      break;
  }
  throw new Error(`cannot decode enum ${type.typeName} from JSON: ${debugJsonValue(json2)}`);
}
function canEmitFieldDefaultValue(field) {
  if (field.repeated || field.kind == "map") {
    return true;
  }
  if (field.oneof) {
    return false;
  }
  if (field.kind == "message") {
    return false;
  }
  if (field.opt || field.req) {
    return false;
  }
  return true;
}
function writeField(field, value, options) {
  if (field.kind == "map") {
    assert(typeof value == "object" && value != null);
    const jsonObj = {};
    const entries = Object.entries(value);
    switch (field.V.kind) {
      case "scalar":
        for (const [entryKey, entryValue] of entries) {
          jsonObj[entryKey.toString()] = writeScalar(field.V.T, entryValue);
        }
        break;
      case "message":
        for (const [entryKey, entryValue] of entries) {
          jsonObj[entryKey.toString()] = entryValue.toJson(options);
        }
        break;
      case "enum":
        const enumType = field.V.T;
        for (const [entryKey, entryValue] of entries) {
          jsonObj[entryKey.toString()] = writeEnum(enumType, entryValue, options.enumAsInteger);
        }
        break;
    }
    return options.emitDefaultValues || entries.length > 0 ? jsonObj : void 0;
  }
  if (field.repeated) {
    assert(Array.isArray(value));
    const jsonArr = [];
    switch (field.kind) {
      case "scalar":
        for (let i = 0; i < value.length; i++) {
          jsonArr.push(writeScalar(field.T, value[i]));
        }
        break;
      case "enum":
        for (let i = 0; i < value.length; i++) {
          jsonArr.push(writeEnum(field.T, value[i], options.enumAsInteger));
        }
        break;
      case "message":
        for (let i = 0; i < value.length; i++) {
          jsonArr.push(value[i].toJson(options));
        }
        break;
    }
    return options.emitDefaultValues || jsonArr.length > 0 ? jsonArr : void 0;
  }
  switch (field.kind) {
    case "scalar":
      return writeScalar(field.T, value);
    case "enum":
      return writeEnum(field.T, value, options.enumAsInteger);
    case "message":
      return wrapField(field.T, value).toJson(options);
  }
}
function writeEnum(type, value, enumAsInteger) {
  var _a;
  assert(typeof value == "number");
  if (type.typeName == "google.protobuf.NullValue") {
    return null;
  }
  if (enumAsInteger) {
    return value;
  }
  const val = type.findNumber(value);
  return (_a = val === null || val === void 0 ? void 0 : val.name) !== null && _a !== void 0 ? _a : value;
}
function writeScalar(type, value) {
  switch (type) {
    // int32, fixed32, uint32: JSON value will be a decimal number. Either numbers or strings are accepted.
    case ScalarType.INT32:
    case ScalarType.SFIXED32:
    case ScalarType.SINT32:
    case ScalarType.FIXED32:
    case ScalarType.UINT32:
      assert(typeof value == "number");
      return value;
    // float, double: JSON value will be a number or one of the special string values "NaN", "Infinity", and "-Infinity".
    // Either numbers or strings are accepted. Exponent notation is also accepted.
    case ScalarType.FLOAT:
    // assertFloat32(value);
    case ScalarType.DOUBLE:
      assert(typeof value == "number");
      if (Number.isNaN(value))
        return "NaN";
      if (value === Number.POSITIVE_INFINITY)
        return "Infinity";
      if (value === Number.NEGATIVE_INFINITY)
        return "-Infinity";
      return value;
    // string:
    case ScalarType.STRING:
      assert(typeof value == "string");
      return value;
    // bool:
    case ScalarType.BOOL:
      assert(typeof value == "boolean");
      return value;
    // JSON value will be a decimal string. Either numbers or strings are accepted.
    case ScalarType.UINT64:
    case ScalarType.FIXED64:
    case ScalarType.INT64:
    case ScalarType.SFIXED64:
    case ScalarType.SINT64:
      assert(typeof value == "bigint" || typeof value == "string" || typeof value == "number");
      return value.toString();
    // bytes: JSON value will be the data encoded as a string using standard base64 encoding with paddings.
    // Either standard or URL-safe base64 encoding with/without paddings are accepted.
    case ScalarType.BYTES:
      assert(value instanceof Uint8Array);
      return protoBase64.enc(value);
  }
}

// node_modules/@bufbuild/protobuf/dist/esm/private/binary-format.js
var unknownFieldsSymbol = /* @__PURE__ */ Symbol("@bufbuild/protobuf/unknown-fields");
var readDefaults = {
  readUnknownFields: true,
  readerFactory: (bytes) => new BinaryReader(bytes)
};
var writeDefaults = {
  writeUnknownFields: true,
  writerFactory: () => new BinaryWriter()
};
function makeReadOptions2(options) {
  return options ? Object.assign(Object.assign({}, readDefaults), options) : readDefaults;
}
function makeWriteOptions2(options) {
  return options ? Object.assign(Object.assign({}, writeDefaults), options) : writeDefaults;
}
function makeBinaryFormat() {
  return {
    makeReadOptions: makeReadOptions2,
    makeWriteOptions: makeWriteOptions2,
    listUnknownFields(message2) {
      var _a;
      return (_a = message2[unknownFieldsSymbol]) !== null && _a !== void 0 ? _a : [];
    },
    discardUnknownFields(message2) {
      delete message2[unknownFieldsSymbol];
    },
    writeUnknownFields(message2, writer) {
      const m = message2;
      const c = m[unknownFieldsSymbol];
      if (c) {
        for (const f of c) {
          writer.tag(f.no, f.wireType).raw(f.data);
        }
      }
    },
    onUnknownField(message2, no, wireType, data) {
      const m = message2;
      if (!Array.isArray(m[unknownFieldsSymbol])) {
        m[unknownFieldsSymbol] = [];
      }
      m[unknownFieldsSymbol].push({ no, wireType, data });
    },
    readMessage(message2, reader, lengthOrEndTagFieldNo, options, delimitedMessageEncoding) {
      const type = message2.getType();
      const end = delimitedMessageEncoding ? reader.len : reader.pos + lengthOrEndTagFieldNo;
      let fieldNo, wireType;
      while (reader.pos < end) {
        [fieldNo, wireType] = reader.tag();
        if (delimitedMessageEncoding === true && wireType == WireType.EndGroup) {
          break;
        }
        const field = type.fields.find(fieldNo);
        if (!field) {
          const data = reader.skip(wireType, fieldNo);
          if (options.readUnknownFields) {
            this.onUnknownField(message2, fieldNo, wireType, data);
          }
          continue;
        }
        readField2(message2, reader, field, wireType, options);
      }
      if (delimitedMessageEncoding && // eslint-disable-line @typescript-eslint/strict-boolean-expressions
      (wireType != WireType.EndGroup || fieldNo !== lengthOrEndTagFieldNo)) {
        throw new Error(`invalid end group tag`);
      }
    },
    readField: readField2,
    writeMessage(message2, writer, options) {
      const type = message2.getType();
      for (const field of type.fields.byNumber()) {
        if (!isFieldSet(field, message2)) {
          if (field.req) {
            throw new Error(`cannot encode field ${type.typeName}.${field.name} to binary: required field not set`);
          }
          continue;
        }
        const value = field.oneof ? message2[field.oneof.localName].value : message2[field.localName];
        writeField2(field, value, writer, options);
      }
      if (options.writeUnknownFields) {
        this.writeUnknownFields(message2, writer);
      }
      return writer;
    },
    writeField(field, value, writer, options) {
      if (value === void 0) {
        return void 0;
      }
      writeField2(field, value, writer, options);
    }
  };
}
function readField2(target, reader, field, wireType, options) {
  let { repeated, localName } = field;
  if (field.oneof) {
    target = target[field.oneof.localName];
    if (target.case != localName) {
      delete target.value;
    }
    target.case = localName;
    localName = "value";
  }
  switch (field.kind) {
    case "scalar":
    case "enum":
      const scalarType = field.kind == "enum" ? ScalarType.INT32 : field.T;
      let read = readScalar2;
      if (field.kind == "scalar" && field.L > 0) {
        read = readScalarLTString;
      }
      if (repeated) {
        let arr = target[localName];
        const isPacked = wireType == WireType.LengthDelimited && scalarType != ScalarType.STRING && scalarType != ScalarType.BYTES;
        if (isPacked) {
          let e = reader.uint32() + reader.pos;
          while (reader.pos < e) {
            arr.push(read(reader, scalarType));
          }
        } else {
          arr.push(read(reader, scalarType));
        }
      } else {
        target[localName] = read(reader, scalarType);
      }
      break;
    case "message":
      const messageType = field.T;
      if (repeated) {
        target[localName].push(readMessageField(reader, new messageType(), options, field));
      } else {
        if (isMessage(target[localName])) {
          readMessageField(reader, target[localName], options, field);
        } else {
          target[localName] = readMessageField(reader, new messageType(), options, field);
          if (messageType.fieldWrapper && !field.oneof && !field.repeated) {
            target[localName] = messageType.fieldWrapper.unwrapField(target[localName]);
          }
        }
      }
      break;
    case "map":
      let [mapKey, mapVal] = readMapEntry(field, reader, options);
      target[localName][mapKey] = mapVal;
      break;
  }
}
function readMessageField(reader, message2, options, field) {
  const format = message2.getType().runtime.bin;
  const delimited = field === null || field === void 0 ? void 0 : field.delimited;
  format.readMessage(
    message2,
    reader,
    delimited ? field.no : reader.uint32(),
    // eslint-disable-line @typescript-eslint/strict-boolean-expressions
    options,
    delimited
  );
  return message2;
}
function readMapEntry(field, reader, options) {
  const length = reader.uint32(), end = reader.pos + length;
  let key, val;
  while (reader.pos < end) {
    const [fieldNo] = reader.tag();
    switch (fieldNo) {
      case 1:
        key = readScalar2(reader, field.K);
        break;
      case 2:
        switch (field.V.kind) {
          case "scalar":
            val = readScalar2(reader, field.V.T);
            break;
          case "enum":
            val = reader.int32();
            break;
          case "message":
            val = readMessageField(reader, new field.V.T(), options, void 0);
            break;
        }
        break;
    }
  }
  if (key === void 0) {
    key = scalarZeroValue(field.K, LongType.BIGINT);
  }
  if (typeof key != "string" && typeof key != "number") {
    key = key.toString();
  }
  if (val === void 0) {
    switch (field.V.kind) {
      case "scalar":
        val = scalarZeroValue(field.V.T, LongType.BIGINT);
        break;
      case "enum":
        val = field.V.T.values[0].no;
        break;
      case "message":
        val = new field.V.T();
        break;
    }
  }
  return [key, val];
}
function readScalarLTString(reader, type) {
  const v = readScalar2(reader, type);
  return typeof v == "bigint" ? v.toString() : v;
}
function readScalar2(reader, type) {
  switch (type) {
    case ScalarType.STRING:
      return reader.string();
    case ScalarType.BOOL:
      return reader.bool();
    case ScalarType.DOUBLE:
      return reader.double();
    case ScalarType.FLOAT:
      return reader.float();
    case ScalarType.INT32:
      return reader.int32();
    case ScalarType.INT64:
      return reader.int64();
    case ScalarType.UINT64:
      return reader.uint64();
    case ScalarType.FIXED64:
      return reader.fixed64();
    case ScalarType.BYTES:
      return reader.bytes();
    case ScalarType.FIXED32:
      return reader.fixed32();
    case ScalarType.SFIXED32:
      return reader.sfixed32();
    case ScalarType.SFIXED64:
      return reader.sfixed64();
    case ScalarType.SINT64:
      return reader.sint64();
    case ScalarType.UINT32:
      return reader.uint32();
    case ScalarType.SINT32:
      return reader.sint32();
  }
}
function writeField2(field, value, writer, options) {
  assert(value !== void 0);
  const repeated = field.repeated;
  switch (field.kind) {
    case "scalar":
    case "enum":
      let scalarType = field.kind == "enum" ? ScalarType.INT32 : field.T;
      if (repeated) {
        assert(Array.isArray(value));
        if (field.packed) {
          writePacked(writer, scalarType, field.no, value);
        } else {
          for (const item of value) {
            writeScalar2(writer, scalarType, field.no, item);
          }
        }
      } else {
        writeScalar2(writer, scalarType, field.no, value);
      }
      break;
    case "message":
      if (repeated) {
        assert(Array.isArray(value));
        for (const item of value) {
          writeMessageField(writer, options, field, item);
        }
      } else {
        writeMessageField(writer, options, field, value);
      }
      break;
    case "map":
      assert(typeof value == "object" && value != null);
      for (const [key, val] of Object.entries(value)) {
        writeMapEntry(writer, options, field, key, val);
      }
      break;
  }
}
function writeMapEntry(writer, options, field, key, value) {
  writer.tag(field.no, WireType.LengthDelimited);
  writer.fork();
  let keyValue = key;
  switch (field.K) {
    case ScalarType.INT32:
    case ScalarType.FIXED32:
    case ScalarType.UINT32:
    case ScalarType.SFIXED32:
    case ScalarType.SINT32:
      keyValue = Number.parseInt(key);
      break;
    case ScalarType.BOOL:
      assert(key == "true" || key == "false");
      keyValue = key == "true";
      break;
  }
  writeScalar2(writer, field.K, 1, keyValue);
  switch (field.V.kind) {
    case "scalar":
      writeScalar2(writer, field.V.T, 2, value);
      break;
    case "enum":
      writeScalar2(writer, ScalarType.INT32, 2, value);
      break;
    case "message":
      assert(value !== void 0);
      writer.tag(2, WireType.LengthDelimited).bytes(value.toBinary(options));
      break;
  }
  writer.join();
}
function writeMessageField(writer, options, field, value) {
  const message2 = wrapField(field.T, value);
  if (field.delimited)
    writer.tag(field.no, WireType.StartGroup).raw(message2.toBinary(options)).tag(field.no, WireType.EndGroup);
  else
    writer.tag(field.no, WireType.LengthDelimited).bytes(message2.toBinary(options));
}
function writeScalar2(writer, type, fieldNo, value) {
  assert(value !== void 0);
  let [wireType, method] = scalarTypeInfo(type);
  writer.tag(fieldNo, wireType)[method](value);
}
function writePacked(writer, type, fieldNo, value) {
  if (!value.length) {
    return;
  }
  writer.tag(fieldNo, WireType.LengthDelimited).fork();
  let [, method] = scalarTypeInfo(type);
  for (let i = 0; i < value.length; i++) {
    writer[method](value[i]);
  }
  writer.join();
}
function scalarTypeInfo(type) {
  let wireType = WireType.Varint;
  switch (type) {
    case ScalarType.BYTES:
    case ScalarType.STRING:
      wireType = WireType.LengthDelimited;
      break;
    case ScalarType.DOUBLE:
    case ScalarType.FIXED64:
    case ScalarType.SFIXED64:
      wireType = WireType.Bit64;
      break;
    case ScalarType.FIXED32:
    case ScalarType.SFIXED32:
    case ScalarType.FLOAT:
      wireType = WireType.Bit32;
      break;
  }
  const method = ScalarType[type].toLowerCase();
  return [wireType, method];
}

// node_modules/@bufbuild/protobuf/dist/esm/private/util-common.js
function makeUtilCommon() {
  return {
    setEnumType,
    initPartial(source, target) {
      if (source === void 0) {
        return;
      }
      const type = target.getType();
      for (const member of type.fields.byMember()) {
        const localName = member.localName, t = target, s = source;
        if (s[localName] == null) {
          continue;
        }
        switch (member.kind) {
          case "oneof":
            const sk = s[localName].case;
            if (sk === void 0) {
              continue;
            }
            const sourceField = member.findField(sk);
            let val = s[localName].value;
            if (sourceField && sourceField.kind == "message" && !isMessage(val, sourceField.T)) {
              val = new sourceField.T(val);
            } else if (sourceField && sourceField.kind === "scalar" && sourceField.T === ScalarType.BYTES) {
              val = toU8Arr(val);
            }
            t[localName] = { case: sk, value: val };
            break;
          case "scalar":
          case "enum":
            let copy = s[localName];
            if (member.T === ScalarType.BYTES) {
              copy = member.repeated ? copy.map(toU8Arr) : toU8Arr(copy);
            }
            t[localName] = copy;
            break;
          case "map":
            switch (member.V.kind) {
              case "scalar":
              case "enum":
                if (member.V.T === ScalarType.BYTES) {
                  for (const [k, v] of Object.entries(s[localName])) {
                    t[localName][k] = toU8Arr(v);
                  }
                } else {
                  Object.assign(t[localName], s[localName]);
                }
                break;
              case "message":
                const messageType = member.V.T;
                for (const k of Object.keys(s[localName])) {
                  let val2 = s[localName][k];
                  if (!messageType.fieldWrapper) {
                    val2 = new messageType(val2);
                  }
                  t[localName][k] = val2;
                }
                break;
            }
            break;
          case "message":
            const mt = member.T;
            if (member.repeated) {
              t[localName] = s[localName].map((val2) => isMessage(val2, mt) ? val2 : new mt(val2));
            } else {
              const val2 = s[localName];
              if (mt.fieldWrapper) {
                if (
                  // We can't use BytesValue.typeName as that will create a circular import
                  mt.typeName === "google.protobuf.BytesValue"
                ) {
                  t[localName] = toU8Arr(val2);
                } else {
                  t[localName] = val2;
                }
              } else {
                t[localName] = isMessage(val2, mt) ? val2 : new mt(val2);
              }
            }
            break;
        }
      }
    },
    // TODO use isFieldSet() here to support future field presence
    equals(type, a, b) {
      if (a === b) {
        return true;
      }
      if (!a || !b) {
        return false;
      }
      return type.fields.byMember().every((m) => {
        const va = a[m.localName];
        const vb = b[m.localName];
        if (m.repeated) {
          if (va.length !== vb.length) {
            return false;
          }
          switch (m.kind) {
            case "message":
              return va.every((a2, i) => m.T.equals(a2, vb[i]));
            case "scalar":
              return va.every((a2, i) => scalarEquals(m.T, a2, vb[i]));
            case "enum":
              return va.every((a2, i) => scalarEquals(ScalarType.INT32, a2, vb[i]));
          }
          throw new Error(`repeated cannot contain ${m.kind}`);
        }
        switch (m.kind) {
          case "message":
            let a2 = va;
            let b2 = vb;
            if (m.T.fieldWrapper) {
              if (a2 !== void 0 && !isMessage(a2)) {
                a2 = m.T.fieldWrapper.wrapField(a2);
              }
              if (b2 !== void 0 && !isMessage(b2)) {
                b2 = m.T.fieldWrapper.wrapField(b2);
              }
            }
            return m.T.equals(a2, b2);
          case "enum":
            return scalarEquals(ScalarType.INT32, va, vb);
          case "scalar":
            return scalarEquals(m.T, va, vb);
          case "oneof":
            if (va.case !== vb.case) {
              return false;
            }
            const s = m.findField(va.case);
            if (s === void 0) {
              return true;
            }
            switch (s.kind) {
              case "message":
                return s.T.equals(va.value, vb.value);
              case "enum":
                return scalarEquals(ScalarType.INT32, va.value, vb.value);
              case "scalar":
                return scalarEquals(s.T, va.value, vb.value);
            }
            throw new Error(`oneof cannot contain ${s.kind}`);
          case "map":
            const keys = Object.keys(va).concat(Object.keys(vb));
            switch (m.V.kind) {
              case "message":
                const messageType = m.V.T;
                return keys.every((k) => messageType.equals(va[k], vb[k]));
              case "enum":
                return keys.every((k) => scalarEquals(ScalarType.INT32, va[k], vb[k]));
              case "scalar":
                const scalarType = m.V.T;
                return keys.every((k) => scalarEquals(scalarType, va[k], vb[k]));
            }
            break;
        }
      });
    },
    // TODO use isFieldSet() here to support future field presence
    clone(message2) {
      const type = message2.getType(), target = new type(), any = target;
      for (const member of type.fields.byMember()) {
        const source = message2[member.localName];
        let copy;
        if (member.repeated) {
          copy = source.map(cloneSingularField);
        } else if (member.kind == "map") {
          copy = any[member.localName];
          for (const [key, v] of Object.entries(source)) {
            copy[key] = cloneSingularField(v);
          }
        } else if (member.kind == "oneof") {
          const f = member.findField(source.case);
          copy = f ? { case: source.case, value: cloneSingularField(source.value) } : { case: void 0 };
        } else {
          copy = cloneSingularField(source);
        }
        any[member.localName] = copy;
      }
      for (const uf of type.runtime.bin.listUnknownFields(message2)) {
        type.runtime.bin.onUnknownField(any, uf.no, uf.wireType, uf.data);
      }
      return target;
    }
  };
}
function cloneSingularField(value) {
  if (value === void 0) {
    return value;
  }
  if (isMessage(value)) {
    return value.clone();
  }
  if (value instanceof Uint8Array) {
    const c = new Uint8Array(value.byteLength);
    c.set(value);
    return c;
  }
  return value;
}
function toU8Arr(input) {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

// node_modules/@bufbuild/protobuf/dist/esm/private/proto-runtime.js
function makeProtoRuntime(syntax, newFieldList, initFields) {
  return {
    syntax,
    json: makeJsonFormat(),
    bin: makeBinaryFormat(),
    util: Object.assign(Object.assign({}, makeUtilCommon()), {
      newFieldList,
      initFields
    }),
    makeMessageType(typeName, fields, opt) {
      return makeMessageType(this, typeName, fields, opt);
    },
    makeEnum,
    makeEnumType,
    getEnumType,
    makeExtension(typeName, extendee, field) {
      return makeExtension(this, typeName, extendee, field);
    }
  };
}

// node_modules/@bufbuild/protobuf/dist/esm/private/field-list.js
var InternalFieldList = class {
  constructor(fields, normalizer) {
    this._fields = fields;
    this._normalizer = normalizer;
  }
  findJsonName(jsonName) {
    if (!this.jsonNames) {
      const t = {};
      for (const f of this.list()) {
        t[f.jsonName] = t[f.name] = f;
      }
      this.jsonNames = t;
    }
    return this.jsonNames[jsonName];
  }
  find(fieldNo) {
    if (!this.numbers) {
      const t = {};
      for (const f of this.list()) {
        t[f.no] = f;
      }
      this.numbers = t;
    }
    return this.numbers[fieldNo];
  }
  list() {
    if (!this.all) {
      this.all = this._normalizer(this._fields);
    }
    return this.all;
  }
  byNumber() {
    if (!this.numbersAsc) {
      this.numbersAsc = this.list().concat().sort((a, b) => a.no - b.no);
    }
    return this.numbersAsc;
  }
  byMember() {
    if (!this.members) {
      this.members = [];
      const a = this.members;
      let o;
      for (const f of this.list()) {
        if (f.oneof) {
          if (f.oneof !== o) {
            o = f.oneof;
            a.push(o);
          }
        } else {
          a.push(f);
        }
      }
    }
    return this.members;
  }
};

// node_modules/@bufbuild/protobuf/dist/esm/private/names.js
function localFieldName(protoName, inOneof) {
  const name = protoCamelCase(protoName);
  if (inOneof) {
    return name;
  }
  return safeObjectProperty(safeMessageProperty(name));
}
function localOneofName(protoName) {
  return localFieldName(protoName, false);
}
var fieldJsonName = protoCamelCase;
function protoCamelCase(snakeCase) {
  let capNext = false;
  const b = [];
  for (let i = 0; i < snakeCase.length; i++) {
    let c = snakeCase.charAt(i);
    switch (c) {
      case "_":
        capNext = true;
        break;
      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        b.push(c);
        capNext = false;
        break;
      default:
        if (capNext) {
          capNext = false;
          c = c.toUpperCase();
        }
        b.push(c);
        break;
    }
  }
  return b.join("");
}
var reservedObjectProperties = /* @__PURE__ */ new Set([
  // names reserved by JavaScript
  "constructor",
  "toString",
  "toJSON",
  "valueOf"
]);
var reservedMessageProperties = /* @__PURE__ */ new Set([
  // names reserved by the runtime
  "getType",
  "clone",
  "equals",
  "fromBinary",
  "fromJson",
  "fromJsonString",
  "toBinary",
  "toJson",
  "toJsonString",
  // names reserved by the runtime for the future
  "toObject"
]);
var fallback = (name) => `${name}$`;
var safeMessageProperty = (name) => {
  if (reservedMessageProperties.has(name)) {
    return fallback(name);
  }
  return name;
};
var safeObjectProperty = (name) => {
  if (reservedObjectProperties.has(name)) {
    return fallback(name);
  }
  return name;
};

// node_modules/@bufbuild/protobuf/dist/esm/private/field.js
var InternalOneofInfo = class {
  constructor(name) {
    this.kind = "oneof";
    this.repeated = false;
    this.packed = false;
    this.opt = false;
    this.req = false;
    this.default = void 0;
    this.fields = [];
    this.name = name;
    this.localName = localOneofName(name);
  }
  addField(field) {
    assert(field.oneof === this, `field ${field.name} not one of ${this.name}`);
    this.fields.push(field);
  }
  findField(localName) {
    if (!this._lookup) {
      this._lookup = /* @__PURE__ */ Object.create(null);
      for (let i = 0; i < this.fields.length; i++) {
        this._lookup[this.fields[i].localName] = this.fields[i];
      }
    }
    return this._lookup[localName];
  }
};

// node_modules/@bufbuild/protobuf/dist/esm/private/field-normalize.js
function normalizeFieldInfos(fieldInfos, packedByDefault) {
  var _a, _b, _c, _d, _e, _f;
  const r = [];
  let o;
  for (const field of typeof fieldInfos == "function" ? fieldInfos() : fieldInfos) {
    const f = field;
    f.localName = localFieldName(field.name, field.oneof !== void 0);
    f.jsonName = (_a = field.jsonName) !== null && _a !== void 0 ? _a : fieldJsonName(field.name);
    f.repeated = (_b = field.repeated) !== null && _b !== void 0 ? _b : false;
    if (field.kind == "scalar") {
      f.L = (_c = field.L) !== null && _c !== void 0 ? _c : LongType.BIGINT;
    }
    f.delimited = (_d = field.delimited) !== null && _d !== void 0 ? _d : false;
    f.req = (_e = field.req) !== null && _e !== void 0 ? _e : false;
    f.opt = (_f = field.opt) !== null && _f !== void 0 ? _f : false;
    if (field.packed === void 0) {
      if (packedByDefault) {
        f.packed = field.kind == "enum" || field.kind == "scalar" && field.T != ScalarType.BYTES && field.T != ScalarType.STRING;
      } else {
        f.packed = false;
      }
    }
    if (field.oneof !== void 0) {
      const ooname = typeof field.oneof == "string" ? field.oneof : field.oneof.name;
      if (!o || o.name != ooname) {
        o = new InternalOneofInfo(ooname);
      }
      f.oneof = o;
      o.addField(f);
    }
    r.push(f);
  }
  return r;
}

// node_modules/@bufbuild/protobuf/dist/esm/proto3.js
var proto3 = makeProtoRuntime(
  "proto3",
  (fields) => {
    return new InternalFieldList(fields, (source) => normalizeFieldInfos(source, true));
  },
  // TODO merge with proto2 and initExtensionField, also see initPartial, equals, clone
  (target) => {
    for (const member of target.getType().fields.byMember()) {
      if (member.opt) {
        continue;
      }
      const name = member.localName, t = target;
      if (member.repeated) {
        t[name] = [];
        continue;
      }
      switch (member.kind) {
        case "oneof":
          t[name] = { case: void 0 };
          break;
        case "enum":
          t[name] = 0;
          break;
        case "map":
          t[name] = {};
          break;
        case "scalar":
          t[name] = scalarZeroValue(member.T, member.L);
          break;
        case "message":
          break;
      }
    }
  }
);

// node_modules/@livekit/protocol/dist/index.mjs
var AudioCodec = /* @__PURE__ */ proto3.makeEnum(
  "livekit.AudioCodec",
  [
    { no: 0, name: "DEFAULT_AC" },
    { no: 1, name: "OPUS" },
    { no: 2, name: "AAC" },
    { no: 3, name: "AC_MP3" }
  ]
);
var VideoCodec = /* @__PURE__ */ proto3.makeEnum(
  "livekit.VideoCodec",
  [
    { no: 0, name: "DEFAULT_VC" },
    { no: 1, name: "H264_BASELINE" },
    { no: 2, name: "H264_MAIN" },
    { no: 3, name: "H264_HIGH" },
    { no: 4, name: "VP8" }
  ]
);
var ImageCodec = /* @__PURE__ */ proto3.makeEnum(
  "livekit.ImageCodec",
  [
    { no: 0, name: "IC_DEFAULT" },
    { no: 1, name: "IC_JPEG" }
  ]
);
var BackupCodecPolicy = /* @__PURE__ */ proto3.makeEnum(
  "livekit.BackupCodecPolicy",
  [
    { no: 0, name: "PREFER_REGRESSION" },
    { no: 1, name: "SIMULCAST" },
    { no: 2, name: "REGRESSION" }
  ]
);
var TrackType = /* @__PURE__ */ proto3.makeEnum(
  "livekit.TrackType",
  [
    { no: 0, name: "AUDIO" },
    { no: 1, name: "VIDEO" },
    { no: 2, name: "DATA" }
  ]
);
var TrackSource = /* @__PURE__ */ proto3.makeEnum(
  "livekit.TrackSource",
  [
    { no: 0, name: "UNKNOWN" },
    { no: 1, name: "CAMERA" },
    { no: 2, name: "MICROPHONE" },
    { no: 3, name: "SCREEN_SHARE" },
    { no: 4, name: "SCREEN_SHARE_AUDIO" }
  ]
);
var VideoQuality = /* @__PURE__ */ proto3.makeEnum(
  "livekit.VideoQuality",
  [
    { no: 0, name: "LOW" },
    { no: 1, name: "MEDIUM" },
    { no: 2, name: "HIGH" },
    { no: 3, name: "OFF" }
  ]
);
var DisconnectReason = /* @__PURE__ */ proto3.makeEnum(
  "livekit.DisconnectReason",
  [
    { no: 0, name: "UNKNOWN_REASON" },
    { no: 1, name: "CLIENT_INITIATED" },
    { no: 2, name: "DUPLICATE_IDENTITY" },
    { no: 3, name: "SERVER_SHUTDOWN" },
    { no: 4, name: "PARTICIPANT_REMOVED" },
    { no: 5, name: "ROOM_DELETED" },
    { no: 6, name: "STATE_MISMATCH" },
    { no: 7, name: "JOIN_FAILURE" },
    { no: 8, name: "MIGRATION" },
    { no: 9, name: "SIGNAL_CLOSE" },
    { no: 10, name: "ROOM_CLOSED" },
    { no: 11, name: "USER_UNAVAILABLE" },
    { no: 12, name: "USER_REJECTED" },
    { no: 13, name: "SIP_TRUNK_FAILURE" },
    { no: 14, name: "CONNECTION_TIMEOUT" },
    { no: 15, name: "MEDIA_FAILURE" },
    { no: 16, name: "AGENT_ERROR" }
  ]
);
var RoomEndReason = /* @__PURE__ */ proto3.makeEnum(
  "livekit.RoomEndReason",
  [
    { no: 0, name: "ROOM_END_UNKNOWN" },
    { no: 1, name: "ROOM_END_API_DELETE" },
    { no: 2, name: "ROOM_END_IDLE_TIMEOUT" },
    { no: 3, name: "ROOM_END_SERVER_SHUTDOWN" },
    { no: 4, name: "ROOM_END_SUPERSEDED" },
    { no: 5, name: "ROOM_END_OPEN_FAILED" }
  ]
);
var AudioTrackFeature = /* @__PURE__ */ proto3.makeEnum(
  "livekit.AudioTrackFeature",
  [
    { no: 0, name: "TF_STEREO" },
    { no: 1, name: "TF_NO_DTX" },
    { no: 2, name: "TF_AUTO_GAIN_CONTROL" },
    { no: 3, name: "TF_ECHO_CANCELLATION" },
    { no: 4, name: "TF_NOISE_SUPPRESSION" },
    { no: 5, name: "TF_ENHANCED_NOISE_CANCELLATION" },
    { no: 6, name: "TF_PRECONNECT_BUFFER" }
  ]
);
var PacketTrailerFeature = /* @__PURE__ */ proto3.makeEnum(
  "livekit.PacketTrailerFeature",
  [
    { no: 0, name: "PTF_USER_TIMESTAMP" },
    { no: 1, name: "PTF_FRAME_ID" },
    { no: 2, name: "PTF_USER_DATA" }
  ]
);
var Room = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.Room",
  () => [
    {
      no: 1,
      name: "sid",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 3,
      name: "empty_timeout",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    {
      no: 14,
      name: "departure_timeout",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    {
      no: 4,
      name: "max_participants",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    {
      no: 5,
      name: "creation_time",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 15,
      name: "creation_time_ms",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 6,
      name: "turn_password",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 7, name: "enabled_codecs", kind: "message", T: Codec, repeated: true },
    {
      no: 8,
      name: "metadata",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 9,
      name: "num_participants",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    {
      no: 11,
      name: "num_publishers",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    {
      no: 10,
      name: "active_recording",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    { no: 13, name: "version", kind: "message", T: TimedVersion }
  ]
);
var Codec = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.Codec",
  () => [
    {
      no: 1,
      name: "mime",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "fmtp_line",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    }
  ]
);
var ParticipantPermission = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.ParticipantPermission",
  () => [
    {
      no: 1,
      name: "can_subscribe",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 2,
      name: "can_publish",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 3,
      name: "can_publish_data",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    { no: 9, name: "can_publish_sources", kind: "enum", T: proto3.getEnumType(TrackSource), repeated: true },
    {
      no: 7,
      name: "hidden",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 8,
      name: "recorder",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 10,
      name: "can_update_metadata",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 11,
      name: "agent",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 12,
      name: "can_subscribe_metrics",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 13,
      name: "can_manage_agent_session",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    }
  ]
);
var ParticipantInfo = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.ParticipantInfo",
  () => [
    {
      no: 1,
      name: "sid",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "identity",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 3, name: "state", kind: "enum", T: proto3.getEnumType(ParticipantInfo_State) },
    { no: 4, name: "tracks", kind: "message", T: TrackInfo, repeated: true },
    {
      no: 5,
      name: "metadata",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 6,
      name: "joined_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 17,
      name: "joined_at_ms",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 9,
      name: "name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 10,
      name: "version",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    { no: 11, name: "permission", kind: "message", T: ParticipantPermission },
    {
      no: 12,
      name: "region",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 13,
      name: "is_publisher",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    { no: 14, name: "kind", kind: "enum", T: proto3.getEnumType(ParticipantInfo_Kind) },
    { no: 15, name: "attributes", kind: "map", K: 9, V: {
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    } },
    { no: 16, name: "disconnect_reason", kind: "enum", T: proto3.getEnumType(DisconnectReason) },
    { no: 18, name: "kind_details", kind: "enum", T: proto3.getEnumType(ParticipantInfo_KindDetail), repeated: true },
    { no: 19, name: "data_tracks", kind: "message", T: DataTrackInfo, repeated: true },
    {
      no: 20,
      name: "client_protocol",
      kind: "scalar",
      T: 5
      /* ScalarType.INT32 */
    },
    { no: 21, name: "capabilities", kind: "enum", T: proto3.getEnumType(ClientInfo_Capability), repeated: true }
  ]
);
var ParticipantInfo_State = /* @__PURE__ */ proto3.makeEnum(
  "livekit.ParticipantInfo.State",
  [
    { no: 0, name: "JOINING" },
    { no: 1, name: "JOINED" },
    { no: 2, name: "ACTIVE" },
    { no: 3, name: "DISCONNECTED" }
  ]
);
var ParticipantInfo_Kind = /* @__PURE__ */ proto3.makeEnum(
  "livekit.ParticipantInfo.Kind",
  [
    { no: 0, name: "STANDARD" },
    { no: 1, name: "INGRESS" },
    { no: 2, name: "EGRESS" },
    { no: 3, name: "SIP" },
    { no: 4, name: "AGENT" },
    { no: 7, name: "CONNECTOR" },
    { no: 8, name: "BRIDGE" }
  ]
);
var ParticipantInfo_KindDetail = /* @__PURE__ */ proto3.makeEnum(
  "livekit.ParticipantInfo.KindDetail",
  [
    { no: 0, name: "CLOUD_AGENT" },
    { no: 1, name: "FORWARDED" },
    { no: 2, name: "CONNECTOR_WHATSAPP" },
    { no: 3, name: "CONNECTOR_TWILIO" },
    { no: 4, name: "BRIDGE_RTSP" },
    { no: 5, name: "SIMULATION" }
  ]
);
var Encryption_Type = /* @__PURE__ */ proto3.makeEnum(
  "livekit.Encryption.Type",
  [
    { no: 0, name: "NONE" },
    { no: 1, name: "GCM" },
    { no: 2, name: "CUSTOM" }
  ]
);
var SimulcastCodecInfo = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.SimulcastCodecInfo",
  () => [
    {
      no: 1,
      name: "mime_type",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "mid",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 3,
      name: "cid",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 4, name: "layers", kind: "message", T: VideoLayer, repeated: true },
    { no: 5, name: "video_layer_mode", kind: "enum", T: proto3.getEnumType(VideoLayer_Mode) },
    {
      no: 6,
      name: "sdp_cid",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    }
  ]
);
var TrackInfo = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.TrackInfo",
  () => [
    {
      no: 1,
      name: "sid",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 2, name: "type", kind: "enum", T: proto3.getEnumType(TrackType) },
    {
      no: 3,
      name: "name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 4,
      name: "muted",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 5,
      name: "width",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    {
      no: 6,
      name: "height",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    {
      no: 7,
      name: "simulcast",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 8,
      name: "disable_dtx",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    { no: 9, name: "source", kind: "enum", T: proto3.getEnumType(TrackSource) },
    { no: 10, name: "layers", kind: "message", T: VideoLayer, repeated: true },
    {
      no: 11,
      name: "mime_type",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 12,
      name: "mid",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 13, name: "codecs", kind: "message", T: SimulcastCodecInfo, repeated: true },
    {
      no: 14,
      name: "stereo",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 15,
      name: "disable_red",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    { no: 16, name: "encryption", kind: "enum", T: proto3.getEnumType(Encryption_Type) },
    {
      no: 17,
      name: "stream",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 18, name: "version", kind: "message", T: TimedVersion },
    { no: 19, name: "audio_features", kind: "enum", T: proto3.getEnumType(AudioTrackFeature), repeated: true },
    { no: 20, name: "backup_codec_policy", kind: "enum", T: proto3.getEnumType(BackupCodecPolicy) },
    { no: 21, name: "packet_trailer_features", kind: "enum", T: proto3.getEnumType(PacketTrailerFeature), repeated: true }
  ]
);
var DataTrackInfo = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.DataTrackInfo",
  () => [
    {
      no: 1,
      name: "pub_handle",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    {
      no: 2,
      name: "sid",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 3,
      name: "name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 4, name: "encryption", kind: "enum", T: proto3.getEnumType(Encryption_Type) },
    { no: 5, name: "frame_encoding", kind: "message", T: DataTrackFrameEncoding, opt: true },
    { no: 6, name: "schema", kind: "message", T: DataTrackSchemaId, opt: true }
  ]
);
var DataTrackFrameEncoding = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.DataTrackFrameEncoding",
  () => [
    { no: 1, name: "well_known", kind: "enum", T: proto3.getEnumType(DataTrackFrameEncoding_WellKnownFrameEncoding), oneof: "value" },
    { no: 2, name: "custom", kind: "scalar", T: 9, oneof: "value" }
  ]
);
var DataTrackFrameEncoding_WellKnownFrameEncoding = /* @__PURE__ */ proto3.makeEnum(
  "livekit.DataTrackFrameEncoding.WellKnownFrameEncoding",
  [
    { no: 0, name: "WELL_KNOWN_FRAME_ENCODING_UNSPECIFIED", localName: "UNSPECIFIED" },
    { no: 1, name: "WELL_KNOWN_FRAME_ENCODING_ROS1", localName: "ROS1" },
    { no: 2, name: "WELL_KNOWN_FRAME_ENCODING_CDR", localName: "CDR" },
    { no: 3, name: "WELL_KNOWN_FRAME_ENCODING_PROTOBUF", localName: "PROTOBUF" },
    { no: 4, name: "WELL_KNOWN_FRAME_ENCODING_FLATBUFFER", localName: "FLATBUFFER" },
    { no: 5, name: "WELL_KNOWN_FRAME_ENCODING_CBOR", localName: "CBOR" },
    { no: 6, name: "WELL_KNOWN_FRAME_ENCODING_MSGPACK", localName: "MSGPACK" },
    { no: 7, name: "WELL_KNOWN_FRAME_ENCODING_JSON", localName: "JSON" }
  ]
);
var DataTrackSchemaEncoding = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.DataTrackSchemaEncoding",
  () => [
    { no: 1, name: "well_known", kind: "enum", T: proto3.getEnumType(DataTrackSchemaEncoding_WellKnownSchemaEncoding), oneof: "value" },
    { no: 2, name: "custom", kind: "scalar", T: 9, oneof: "value" }
  ]
);
var DataTrackSchemaEncoding_WellKnownSchemaEncoding = /* @__PURE__ */ proto3.makeEnum(
  "livekit.DataTrackSchemaEncoding.WellKnownSchemaEncoding",
  [
    { no: 0, name: "WELL_KNOWN_SCHEMA_ENCODING_UNSPECIFIED", localName: "UNSPECIFIED" },
    { no: 1, name: "WELL_KNOWN_SCHEMA_ENCODING_PROTOBUF", localName: "PROTOBUF" },
    { no: 2, name: "WELL_KNOWN_SCHEMA_ENCODING_FLATBUFFER", localName: "FLATBUFFER" },
    { no: 3, name: "WELL_KNOWN_SCHEMA_ENCODING_ROS1_MSG", localName: "ROS1_MSG" },
    { no: 4, name: "WELL_KNOWN_SCHEMA_ENCODING_ROS2_MSG", localName: "ROS2_MSG" },
    { no: 5, name: "WELL_KNOWN_SCHEMA_ENCODING_ROS2_IDL", localName: "ROS2_IDL" },
    { no: 6, name: "WELL_KNOWN_SCHEMA_ENCODING_OMG_IDL", localName: "OMG_IDL" },
    { no: 7, name: "WELL_KNOWN_SCHEMA_ENCODING_JSON_SCHEMA", localName: "JSON_SCHEMA" }
  ]
);
var DataTrackSchemaId = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.DataTrackSchemaId",
  () => [
    {
      no: 1,
      name: "name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 2, name: "encoding", kind: "message", T: DataTrackSchemaEncoding }
  ]
);
var VideoLayer = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.VideoLayer",
  () => [
    { no: 1, name: "quality", kind: "enum", T: proto3.getEnumType(VideoQuality) },
    {
      no: 2,
      name: "width",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    {
      no: 3,
      name: "height",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    {
      no: 4,
      name: "bitrate",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    {
      no: 5,
      name: "ssrc",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    {
      no: 6,
      name: "spatial_layer",
      kind: "scalar",
      T: 5
      /* ScalarType.INT32 */
    },
    {
      no: 7,
      name: "rid",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 8,
      name: "repair_ssrc",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    }
  ]
);
var VideoLayer_Mode = /* @__PURE__ */ proto3.makeEnum(
  "livekit.VideoLayer.Mode",
  [
    { no: 0, name: "MODE_UNUSED" },
    { no: 1, name: "ONE_SPATIAL_LAYER_PER_STREAM" },
    { no: 2, name: "MULTIPLE_SPATIAL_LAYERS_PER_STREAM" },
    { no: 3, name: "ONE_SPATIAL_LAYER_PER_STREAM_INCOMPLETE_RTCP_SR" }
  ]
);
var ClientInfo_Capability = /* @__PURE__ */ proto3.makeEnum(
  "livekit.ClientInfo.Capability",
  [
    { no: 0, name: "CAP_UNUSED" },
    { no: 1, name: "CAP_PACKET_TRAILER" },
    { no: 2, name: "CAP_COMPRESSION_DEFLATE_RAW" }
  ]
);
var TimedVersion = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.TimedVersion",
  () => [
    {
      no: 1,
      name: "unix_micro",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 2,
      name: "ticks",
      kind: "scalar",
      T: 5
      /* ScalarType.INT32 */
    }
  ]
);
var FilterParams = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.FilterParams",
  () => [
    { no: 1, name: "include_events", kind: "scalar", T: 9, repeated: true },
    { no: 2, name: "exclude_events", kind: "scalar", T: 9, repeated: true }
  ]
);
var WebhookConfig = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.WebhookConfig",
  () => [
    {
      no: 1,
      name: "url",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "signing_key",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 3, name: "filter_params", kind: "message", T: FilterParams }
  ]
);
var JobType = /* @__PURE__ */ proto3.makeEnum(
  "livekit.JobType",
  [
    { no: 0, name: "JT_ROOM" },
    { no: 1, name: "JT_PUBLISHER" },
    { no: 2, name: "JT_PARTICIPANT" }
  ]
);
var JobStatus = /* @__PURE__ */ proto3.makeEnum(
  "livekit.JobStatus",
  [
    { no: 0, name: "JS_PENDING" },
    { no: 1, name: "JS_RUNNING" },
    { no: 2, name: "JS_SUCCESS" },
    { no: 3, name: "JS_FAILED" }
  ]
);
var Job = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.Job",
  () => [
    {
      no: 1,
      name: "id",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 9,
      name: "dispatch_id",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 2, name: "type", kind: "enum", T: proto3.getEnumType(JobType) },
    { no: 3, name: "room", kind: "message", T: Room },
    { no: 4, name: "participant", kind: "message", T: ParticipantInfo, opt: true },
    {
      no: 5,
      name: "namespace",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 6,
      name: "metadata",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 7,
      name: "agent_name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 8, name: "state", kind: "message", T: JobState },
    {
      no: 10,
      name: "enable_recording",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 11,
      name: "deployment",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 12, name: "attributes", kind: "map", K: 9, V: {
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    } },
    {
      no: 13,
      name: "enable_redaction",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    }
  ]
);
var JobState = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.JobState",
  () => [
    { no: 1, name: "status", kind: "enum", T: proto3.getEnumType(JobStatus) },
    {
      no: 2,
      name: "error",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 3,
      name: "started_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 4,
      name: "ended_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 5,
      name: "updated_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 6,
      name: "participant_identity",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 7,
      name: "worker_id",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 8,
      name: "agent_id",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    }
  ]
);
var AudioChannel = /* @__PURE__ */ proto3.makeEnum(
  "livekit.AudioChannel",
  [
    { no: 0, name: "AUDIO_CHANNEL_BOTH", localName: "BOTH" },
    { no: 1, name: "AUDIO_CHANNEL_LEFT", localName: "LEFT" },
    { no: 2, name: "AUDIO_CHANNEL_RIGHT", localName: "RIGHT" }
  ]
);
var EncodingOptionsPreset = /* @__PURE__ */ proto3.makeEnum(
  "livekit.EncodingOptionsPreset",
  [
    { no: 0, name: "H264_720P_30" },
    { no: 1, name: "H264_720P_60" },
    { no: 2, name: "H264_1080P_30" },
    { no: 3, name: "H264_1080P_60" },
    { no: 4, name: "PORTRAIT_H264_720P_30" },
    { no: 5, name: "PORTRAIT_H264_720P_60" },
    { no: 6, name: "PORTRAIT_H264_1080P_30" },
    { no: 7, name: "PORTRAIT_H264_1080P_60" },
    { no: 8, name: "PASSTHROUGH" }
  ]
);
var EncodedFileType = /* @__PURE__ */ proto3.makeEnum(
  "livekit.EncodedFileType",
  [
    { no: 0, name: "DEFAULT_FILETYPE" },
    { no: 1, name: "MP4" },
    { no: 2, name: "OGG" },
    { no: 3, name: "MP3" }
  ]
);
var StreamProtocol = /* @__PURE__ */ proto3.makeEnum(
  "livekit.StreamProtocol",
  [
    { no: 0, name: "DEFAULT_PROTOCOL" },
    { no: 1, name: "RTMP" },
    { no: 2, name: "SRT" },
    { no: 3, name: "WEBSOCKET" }
  ]
);
var SegmentedFileProtocol = /* @__PURE__ */ proto3.makeEnum(
  "livekit.SegmentedFileProtocol",
  [
    { no: 0, name: "DEFAULT_SEGMENTED_FILE_PROTOCOL" },
    { no: 1, name: "HLS_PROTOCOL" }
  ]
);
var SegmentedFileSuffix = /* @__PURE__ */ proto3.makeEnum(
  "livekit.SegmentedFileSuffix",
  [
    { no: 0, name: "INDEX" },
    { no: 1, name: "TIMESTAMP" }
  ]
);
var ImageFileSuffix = /* @__PURE__ */ proto3.makeEnum(
  "livekit.ImageFileSuffix",
  [
    { no: 0, name: "IMAGE_SUFFIX_INDEX" },
    { no: 1, name: "IMAGE_SUFFIX_TIMESTAMP" },
    { no: 2, name: "IMAGE_SUFFIX_NONE_OVERWRITE" }
  ]
);
var EgressSourceType = /* @__PURE__ */ proto3.makeEnum(
  "livekit.EgressSourceType",
  [
    { no: 0, name: "EGRESS_SOURCE_TYPE_WEB", localName: "WEB" },
    { no: 1, name: "EGRESS_SOURCE_TYPE_SDK", localName: "SDK" }
  ]
);
var EgressStatus = /* @__PURE__ */ proto3.makeEnum(
  "livekit.EgressStatus",
  [
    { no: 0, name: "EGRESS_STARTING" },
    { no: 1, name: "EGRESS_ACTIVE" },
    { no: 2, name: "EGRESS_ENDING" },
    { no: 3, name: "EGRESS_COMPLETE" },
    { no: 4, name: "EGRESS_FAILED" },
    { no: 5, name: "EGRESS_ABORTED" },
    { no: 6, name: "EGRESS_LIMIT_REACHED" }
  ]
);
var AudioMixing = /* @__PURE__ */ proto3.makeEnum(
  "livekit.AudioMixing",
  [
    { no: 0, name: "DEFAULT_MIXING" },
    { no: 1, name: "DUAL_CHANNEL_AGENT" },
    { no: 2, name: "DUAL_CHANNEL_ALTERNATE" }
  ]
);
var StartEgressRequest = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.StartEgressRequest",
  () => [
    {
      no: 1,
      name: "room_name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 2, name: "template", kind: "message", T: TemplateSource, oneof: "source" },
    { no: 3, name: "web", kind: "message", T: WebSource, oneof: "source" },
    { no: 4, name: "media", kind: "message", T: MediaSource, oneof: "source" },
    { no: 5, name: "preset", kind: "enum", T: proto3.getEnumType(EncodingOptionsPreset), oneof: "encoding" },
    { no: 6, name: "advanced", kind: "message", T: EncodingOptions, oneof: "encoding" },
    { no: 7, name: "outputs", kind: "message", T: Output, repeated: true },
    { no: 8, name: "storage", kind: "message", T: StorageConfig },
    { no: 9, name: "webhooks", kind: "message", T: WebhookConfig, repeated: true }
  ]
);
var TemplateSource = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.TemplateSource",
  () => [
    {
      no: 1,
      name: "layout",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "audio_only",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 3,
      name: "video_only",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 4,
      name: "custom_base_url",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    }
  ]
);
var WebSource = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.WebSource",
  () => [
    {
      no: 1,
      name: "url",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "audio_only",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 3,
      name: "video_only",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 4,
      name: "await_start_signal",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    }
  ]
);
var MediaSource = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.MediaSource",
  () => [
    { no: 1, name: "video_track_id", kind: "scalar", T: 9, oneof: "video" },
    { no: 2, name: "participant_video", kind: "message", T: ParticipantVideo, oneof: "video" },
    { no: 3, name: "audio", kind: "message", T: AudioConfig }
  ]
);
var ParticipantVideo = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.ParticipantVideo",
  () => [
    {
      no: 1,
      name: "identity",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "prefer_screen_share",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    }
  ]
);
var AudioConfig = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.AudioConfig",
  () => [
    {
      no: 1,
      name: "capture_all",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    { no: 2, name: "routes", kind: "message", T: AudioRoute, repeated: true }
  ]
);
var AudioRoute = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.AudioRoute",
  () => [
    { no: 1, name: "track_id", kind: "scalar", T: 9, oneof: "match" },
    { no: 2, name: "participant_identity", kind: "scalar", T: 9, oneof: "match" },
    { no: 3, name: "participant_kind", kind: "enum", T: proto3.getEnumType(ParticipantInfo_Kind), oneof: "match" },
    { no: 4, name: "channel", kind: "enum", T: proto3.getEnumType(AudioChannel) }
  ]
);
var EncodingOptions = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.EncodingOptions",
  () => [
    {
      no: 1,
      name: "width",
      kind: "scalar",
      T: 5
      /* ScalarType.INT32 */
    },
    {
      no: 2,
      name: "height",
      kind: "scalar",
      T: 5
      /* ScalarType.INT32 */
    },
    {
      no: 3,
      name: "depth",
      kind: "scalar",
      T: 5
      /* ScalarType.INT32 */
    },
    {
      no: 4,
      name: "framerate",
      kind: "scalar",
      T: 5
      /* ScalarType.INT32 */
    },
    { no: 5, name: "audio_codec", kind: "enum", T: proto3.getEnumType(AudioCodec) },
    {
      no: 6,
      name: "audio_bitrate",
      kind: "scalar",
      T: 5
      /* ScalarType.INT32 */
    },
    {
      no: 7,
      name: "audio_frequency",
      kind: "scalar",
      T: 5
      /* ScalarType.INT32 */
    },
    { no: 8, name: "video_codec", kind: "enum", T: proto3.getEnumType(VideoCodec) },
    {
      no: 9,
      name: "video_bitrate",
      kind: "scalar",
      T: 5
      /* ScalarType.INT32 */
    },
    {
      no: 10,
      name: "key_frame_interval",
      kind: "scalar",
      T: 1
      /* ScalarType.DOUBLE */
    },
    {
      no: 11,
      name: "audio_quality",
      kind: "scalar",
      T: 5
      /* ScalarType.INT32 */
    },
    {
      no: 12,
      name: "video_quality",
      kind: "scalar",
      T: 5
      /* ScalarType.INT32 */
    }
  ]
);
var Output = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.Output",
  () => [
    { no: 1, name: "file", kind: "message", T: FileOutput, oneof: "config" },
    { no: 2, name: "stream", kind: "message", T: StreamOutput, oneof: "config" },
    { no: 3, name: "segments", kind: "message", T: SegmentedFileOutput, oneof: "config" },
    { no: 4, name: "images", kind: "message", T: ImageOutput, oneof: "config" },
    { no: 6, name: "storage", kind: "message", T: StorageConfig }
  ]
);
var FileOutput = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.FileOutput",
  () => [
    { no: 1, name: "file_type", kind: "enum", T: proto3.getEnumType(EncodedFileType) },
    {
      no: 2,
      name: "filepath",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 3,
      name: "disable_manifest",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    }
  ]
);
var StreamOutput = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.StreamOutput",
  () => [
    { no: 1, name: "protocol", kind: "enum", T: proto3.getEnumType(StreamProtocol) },
    { no: 2, name: "urls", kind: "scalar", T: 9, repeated: true }
  ]
);
var SegmentedFileOutput = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.SegmentedFileOutput",
  () => [
    { no: 1, name: "protocol", kind: "enum", T: proto3.getEnumType(SegmentedFileProtocol) },
    {
      no: 2,
      name: "filename_prefix",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 3,
      name: "playlist_name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 11,
      name: "live_playlist_name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 4,
      name: "segment_duration",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    { no: 10, name: "filename_suffix", kind: "enum", T: proto3.getEnumType(SegmentedFileSuffix) },
    {
      no: 8,
      name: "disable_manifest",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    { no: 5, name: "s3", kind: "message", T: S3Upload, oneof: "output" },
    { no: 6, name: "gcp", kind: "message", T: GCPUpload, oneof: "output" },
    { no: 7, name: "azure", kind: "message", T: AzureBlobUpload, oneof: "output" },
    { no: 9, name: "aliOSS", kind: "message", T: AliOSSUpload, oneof: "output" }
  ]
);
var ImageOutput = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.ImageOutput",
  () => [
    {
      no: 1,
      name: "capture_interval",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    {
      no: 2,
      name: "width",
      kind: "scalar",
      T: 5
      /* ScalarType.INT32 */
    },
    {
      no: 3,
      name: "height",
      kind: "scalar",
      T: 5
      /* ScalarType.INT32 */
    },
    {
      no: 4,
      name: "filename_prefix",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 5, name: "filename_suffix", kind: "enum", T: proto3.getEnumType(ImageFileSuffix) },
    { no: 6, name: "image_codec", kind: "enum", T: proto3.getEnumType(ImageCodec) },
    {
      no: 7,
      name: "disable_manifest",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    { no: 8, name: "s3", kind: "message", T: S3Upload, oneof: "output" },
    { no: 9, name: "gcp", kind: "message", T: GCPUpload, oneof: "output" },
    { no: 10, name: "azure", kind: "message", T: AzureBlobUpload, oneof: "output" },
    { no: 11, name: "aliOSS", kind: "message", T: AliOSSUpload, oneof: "output" }
  ]
);
var StorageConfig = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.StorageConfig",
  () => [
    { no: 1, name: "s3", kind: "message", T: S3Upload, oneof: "provider" },
    { no: 2, name: "gcp", kind: "message", T: GCPUpload, oneof: "provider" },
    { no: 3, name: "azure", kind: "message", T: AzureBlobUpload, oneof: "provider" },
    { no: 4, name: "aliOSS", kind: "message", T: AliOSSUpload, oneof: "provider" }
  ]
);
var S3Upload = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.S3Upload",
  () => [
    {
      no: 1,
      name: "access_key",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "secret",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 11,
      name: "session_token",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 12,
      name: "assume_role_arn",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 13,
      name: "assume_role_external_id",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 3,
      name: "region",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 4,
      name: "endpoint",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 5,
      name: "bucket",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 6,
      name: "force_path_style",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    { no: 7, name: "metadata", kind: "map", K: 9, V: {
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    } },
    {
      no: 8,
      name: "tagging",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 9,
      name: "content_disposition",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 10, name: "proxy", kind: "message", T: ProxyConfig }
  ]
);
var GCPUpload = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.GCPUpload",
  () => [
    {
      no: 1,
      name: "credentials",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "bucket",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 3, name: "proxy", kind: "message", T: ProxyConfig }
  ]
);
var AzureBlobUpload = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.AzureBlobUpload",
  () => [
    {
      no: 1,
      name: "account_name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "account_key",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 3,
      name: "container_name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    }
  ]
);
var AliOSSUpload = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.AliOSSUpload",
  () => [
    {
      no: 1,
      name: "access_key",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "secret",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 3,
      name: "region",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 4,
      name: "endpoint",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 5,
      name: "bucket",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    }
  ]
);
var ProxyConfig = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.ProxyConfig",
  () => [
    {
      no: 1,
      name: "url",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "username",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 3,
      name: "password",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    }
  ]
);
var EgressInfo = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.EgressInfo",
  () => [
    {
      no: 1,
      name: "egress_id",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "room_id",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 13,
      name: "room_name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 26, name: "source_type", kind: "enum", T: proto3.getEnumType(EgressSourceType) },
    { no: 3, name: "status", kind: "enum", T: proto3.getEnumType(EgressStatus) },
    {
      no: 10,
      name: "started_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 11,
      name: "ended_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 18,
      name: "updated_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    { no: 29, name: "egress", kind: "message", T: StartEgressRequest, oneof: "request" },
    { no: 30, name: "replay", kind: "message", T: ExportReplayRequest, oneof: "request" },
    { no: 4, name: "room_composite", kind: "message", T: RoomCompositeEgressRequest, oneof: "request" },
    { no: 14, name: "web", kind: "message", T: WebEgressRequest, oneof: "request" },
    { no: 19, name: "participant", kind: "message", T: ParticipantEgressRequest, oneof: "request" },
    { no: 5, name: "track_composite", kind: "message", T: TrackCompositeEgressRequest, oneof: "request" },
    { no: 6, name: "track", kind: "message", T: TrackEgressRequest, oneof: "request" },
    { no: 15, name: "stream_results", kind: "message", T: StreamInfo, repeated: true },
    { no: 16, name: "file_results", kind: "message", T: FileInfo, repeated: true },
    { no: 17, name: "segment_results", kind: "message", T: SegmentsInfo, repeated: true },
    { no: 20, name: "image_results", kind: "message", T: ImagesInfo, repeated: true },
    {
      no: 9,
      name: "error",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 22,
      name: "error_code",
      kind: "scalar",
      T: 5
      /* ScalarType.INT32 */
    },
    {
      no: 21,
      name: "details",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 23,
      name: "manifest_location",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 25,
      name: "backup_storage_used",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 27,
      name: "retry_count",
      kind: "scalar",
      T: 5
      /* ScalarType.INT32 */
    },
    { no: 7, name: "stream", kind: "message", T: StreamInfoList, oneof: "result" },
    { no: 8, name: "file", kind: "message", T: FileInfo, oneof: "result" },
    { no: 12, name: "segments", kind: "message", T: SegmentsInfo, oneof: "result" }
  ]
);
var StreamInfo = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.StreamInfo",
  () => [
    {
      no: 1,
      name: "url",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "started_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 3,
      name: "ended_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 4,
      name: "duration",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    { no: 5, name: "status", kind: "enum", T: proto3.getEnumType(StreamInfo_Status) },
    {
      no: 6,
      name: "error",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 7,
      name: "last_retry_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 8,
      name: "retries",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    }
  ]
);
var StreamInfo_Status = /* @__PURE__ */ proto3.makeEnum(
  "livekit.StreamInfo.Status",
  [
    { no: 0, name: "ACTIVE" },
    { no: 1, name: "FINISHED" },
    { no: 2, name: "FAILED" }
  ]
);
var FileInfo = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.FileInfo",
  () => [
    {
      no: 1,
      name: "filename",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "started_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 3,
      name: "ended_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 6,
      name: "duration",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 4,
      name: "size",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 5,
      name: "location",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    }
  ]
);
var SegmentsInfo = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.SegmentsInfo",
  () => [
    {
      no: 1,
      name: "playlist_name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 8,
      name: "live_playlist_name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "duration",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 3,
      name: "size",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 4,
      name: "playlist_location",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 9,
      name: "live_playlist_location",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 5,
      name: "segment_count",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 6,
      name: "started_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 7,
      name: "ended_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    }
  ]
);
var ImagesInfo = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.ImagesInfo",
  () => [
    {
      no: 4,
      name: "filename_prefix",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 1,
      name: "image_count",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 2,
      name: "started_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 3,
      name: "ended_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    }
  ]
);
var ExportReplayRequest = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.ExportReplayRequest",
  () => [
    {
      no: 1,
      name: "replay_id",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "start_offset_ms",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 3,
      name: "end_offset_ms",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    { no: 4, name: "template", kind: "message", T: TemplateSource, oneof: "source" },
    { no: 5, name: "web", kind: "message", T: WebSource, oneof: "source" },
    { no: 6, name: "media", kind: "message", T: MediaSource, oneof: "source" },
    { no: 7, name: "preset", kind: "enum", T: proto3.getEnumType(EncodingOptionsPreset), oneof: "encoding" },
    { no: 8, name: "advanced", kind: "message", T: EncodingOptions, oneof: "encoding" },
    { no: 9, name: "outputs", kind: "message", T: Output, repeated: true },
    { no: 10, name: "storage", kind: "message", T: StorageConfig },
    { no: 11, name: "webhooks", kind: "message", T: WebhookConfig, repeated: true }
  ]
);
var RoomCompositeEgressRequest = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.RoomCompositeEgressRequest",
  () => [
    {
      no: 1,
      name: "room_name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "layout",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 3,
      name: "audio_only",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    { no: 15, name: "audio_mixing", kind: "enum", T: proto3.getEnumType(AudioMixing) },
    {
      no: 4,
      name: "video_only",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 5,
      name: "custom_base_url",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 6, name: "file", kind: "message", T: EncodedFileOutput, oneof: "output" },
    { no: 7, name: "stream", kind: "message", T: StreamOutput, oneof: "output" },
    { no: 10, name: "segments", kind: "message", T: SegmentedFileOutput, oneof: "output" },
    { no: 8, name: "preset", kind: "enum", T: proto3.getEnumType(EncodingOptionsPreset), oneof: "options" },
    { no: 9, name: "advanced", kind: "message", T: EncodingOptions, oneof: "options" },
    { no: 11, name: "file_outputs", kind: "message", T: EncodedFileOutput, repeated: true },
    { no: 12, name: "stream_outputs", kind: "message", T: StreamOutput, repeated: true },
    { no: 13, name: "segment_outputs", kind: "message", T: SegmentedFileOutput, repeated: true },
    { no: 14, name: "image_outputs", kind: "message", T: ImageOutput, repeated: true },
    { no: 16, name: "webhooks", kind: "message", T: WebhookConfig, repeated: true }
  ]
);
var WebEgressRequest = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.WebEgressRequest",
  () => [
    {
      no: 1,
      name: "url",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "audio_only",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 3,
      name: "video_only",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 12,
      name: "await_start_signal",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    { no: 4, name: "file", kind: "message", T: EncodedFileOutput, oneof: "output" },
    { no: 5, name: "stream", kind: "message", T: StreamOutput, oneof: "output" },
    { no: 6, name: "segments", kind: "message", T: SegmentedFileOutput, oneof: "output" },
    { no: 7, name: "preset", kind: "enum", T: proto3.getEnumType(EncodingOptionsPreset), oneof: "options" },
    { no: 8, name: "advanced", kind: "message", T: EncodingOptions, oneof: "options" },
    { no: 9, name: "file_outputs", kind: "message", T: EncodedFileOutput, repeated: true },
    { no: 10, name: "stream_outputs", kind: "message", T: StreamOutput, repeated: true },
    { no: 11, name: "segment_outputs", kind: "message", T: SegmentedFileOutput, repeated: true },
    { no: 13, name: "image_outputs", kind: "message", T: ImageOutput, repeated: true },
    { no: 14, name: "webhooks", kind: "message", T: WebhookConfig, repeated: true }
  ]
);
var ParticipantEgressRequest = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.ParticipantEgressRequest",
  () => [
    {
      no: 1,
      name: "room_name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "identity",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 3,
      name: "screen_share",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    { no: 4, name: "preset", kind: "enum", T: proto3.getEnumType(EncodingOptionsPreset), oneof: "options" },
    { no: 5, name: "advanced", kind: "message", T: EncodingOptions, oneof: "options" },
    { no: 6, name: "file_outputs", kind: "message", T: EncodedFileOutput, repeated: true },
    { no: 7, name: "stream_outputs", kind: "message", T: StreamOutput, repeated: true },
    { no: 8, name: "segment_outputs", kind: "message", T: SegmentedFileOutput, repeated: true },
    { no: 9, name: "image_outputs", kind: "message", T: ImageOutput, repeated: true },
    { no: 10, name: "webhooks", kind: "message", T: WebhookConfig, repeated: true }
  ]
);
var TrackCompositeEgressRequest = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.TrackCompositeEgressRequest",
  () => [
    {
      no: 1,
      name: "room_name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "audio_track_id",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 3,
      name: "video_track_id",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 4, name: "file", kind: "message", T: EncodedFileOutput, oneof: "output" },
    { no: 5, name: "stream", kind: "message", T: StreamOutput, oneof: "output" },
    { no: 8, name: "segments", kind: "message", T: SegmentedFileOutput, oneof: "output" },
    { no: 6, name: "preset", kind: "enum", T: proto3.getEnumType(EncodingOptionsPreset), oneof: "options" },
    { no: 7, name: "advanced", kind: "message", T: EncodingOptions, oneof: "options" },
    { no: 11, name: "file_outputs", kind: "message", T: EncodedFileOutput, repeated: true },
    { no: 12, name: "stream_outputs", kind: "message", T: StreamOutput, repeated: true },
    { no: 13, name: "segment_outputs", kind: "message", T: SegmentedFileOutput, repeated: true },
    { no: 14, name: "image_outputs", kind: "message", T: ImageOutput, repeated: true },
    { no: 15, name: "webhooks", kind: "message", T: WebhookConfig, repeated: true }
  ]
);
var TrackEgressRequest = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.TrackEgressRequest",
  () => [
    {
      no: 1,
      name: "room_name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "track_id",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 3, name: "file", kind: "message", T: DirectFileOutput, oneof: "output" },
    { no: 4, name: "websocket_url", kind: "scalar", T: 9, oneof: "output" },
    { no: 5, name: "webhooks", kind: "message", T: WebhookConfig, repeated: true }
  ]
);
var DirectFileOutput = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.DirectFileOutput",
  () => [
    {
      no: 1,
      name: "filepath",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 5,
      name: "disable_manifest",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    { no: 2, name: "s3", kind: "message", T: S3Upload, oneof: "output" },
    { no: 3, name: "gcp", kind: "message", T: GCPUpload, oneof: "output" },
    { no: 4, name: "azure", kind: "message", T: AzureBlobUpload, oneof: "output" },
    { no: 6, name: "aliOSS", kind: "message", T: AliOSSUpload, oneof: "output" }
  ]
);
var EncodedFileOutput = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.EncodedFileOutput",
  () => [
    { no: 1, name: "file_type", kind: "enum", T: proto3.getEnumType(EncodedFileType) },
    {
      no: 2,
      name: "filepath",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 6,
      name: "disable_manifest",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    { no: 3, name: "s3", kind: "message", T: S3Upload, oneof: "output" },
    { no: 4, name: "gcp", kind: "message", T: GCPUpload, oneof: "output" },
    { no: 5, name: "azure", kind: "message", T: AzureBlobUpload, oneof: "output" },
    { no: 7, name: "aliOSS", kind: "message", T: AliOSSUpload, oneof: "output" }
  ]
);
var StreamInfoList = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.StreamInfoList",
  () => [
    { no: 1, name: "info", kind: "message", T: StreamInfo, repeated: true }
  ]
);
var IngressInput = /* @__PURE__ */ proto3.makeEnum(
  "livekit.IngressInput",
  [
    { no: 0, name: "RTMP_INPUT" },
    { no: 1, name: "WHIP_INPUT" },
    { no: 2, name: "URL_INPUT" }
  ]
);
var IngressAudioEncodingPreset = /* @__PURE__ */ proto3.makeEnum(
  "livekit.IngressAudioEncodingPreset",
  [
    { no: 0, name: "OPUS_STEREO_96KBPS" },
    { no: 1, name: "OPUS_MONO_64KBS" }
  ]
);
var IngressVideoEncodingPreset = /* @__PURE__ */ proto3.makeEnum(
  "livekit.IngressVideoEncodingPreset",
  [
    { no: 0, name: "H264_720P_30FPS_3_LAYERS" },
    { no: 1, name: "H264_1080P_30FPS_3_LAYERS" },
    { no: 2, name: "H264_540P_25FPS_2_LAYERS" },
    { no: 3, name: "H264_720P_30FPS_1_LAYER" },
    { no: 4, name: "H264_1080P_30FPS_1_LAYER" },
    { no: 5, name: "H264_720P_30FPS_3_LAYERS_HIGH_MOTION" },
    { no: 6, name: "H264_1080P_30FPS_3_LAYERS_HIGH_MOTION" },
    { no: 7, name: "H264_540P_25FPS_2_LAYERS_HIGH_MOTION" },
    { no: 8, name: "H264_720P_30FPS_1_LAYER_HIGH_MOTION" },
    { no: 9, name: "H264_1080P_30FPS_1_LAYER_HIGH_MOTION" }
  ]
);
var IngressAudioOptions = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.IngressAudioOptions",
  () => [
    {
      no: 1,
      name: "name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 2, name: "source", kind: "enum", T: proto3.getEnumType(TrackSource) },
    { no: 3, name: "preset", kind: "enum", T: proto3.getEnumType(IngressAudioEncodingPreset), oneof: "encoding_options" },
    { no: 4, name: "options", kind: "message", T: IngressAudioEncodingOptions, oneof: "encoding_options" }
  ]
);
var IngressVideoOptions = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.IngressVideoOptions",
  () => [
    {
      no: 1,
      name: "name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 2, name: "source", kind: "enum", T: proto3.getEnumType(TrackSource) },
    { no: 3, name: "preset", kind: "enum", T: proto3.getEnumType(IngressVideoEncodingPreset), oneof: "encoding_options" },
    { no: 4, name: "options", kind: "message", T: IngressVideoEncodingOptions, oneof: "encoding_options" }
  ]
);
var IngressAudioEncodingOptions = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.IngressAudioEncodingOptions",
  () => [
    { no: 1, name: "audio_codec", kind: "enum", T: proto3.getEnumType(AudioCodec) },
    {
      no: 2,
      name: "bitrate",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    {
      no: 3,
      name: "disable_dtx",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    {
      no: 4,
      name: "channels",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    }
  ]
);
var IngressVideoEncodingOptions = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.IngressVideoEncodingOptions",
  () => [
    { no: 1, name: "video_codec", kind: "enum", T: proto3.getEnumType(VideoCodec) },
    {
      no: 2,
      name: "frame_rate",
      kind: "scalar",
      T: 1
      /* ScalarType.DOUBLE */
    },
    { no: 3, name: "layers", kind: "message", T: VideoLayer, repeated: true }
  ]
);
var IngressInfo = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.IngressInfo",
  () => [
    {
      no: 1,
      name: "ingress_id",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 3,
      name: "stream_key",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 4,
      name: "url",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 5, name: "input_type", kind: "enum", T: proto3.getEnumType(IngressInput) },
    {
      no: 13,
      name: "bypass_transcoding",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    { no: 15, name: "enable_transcoding", kind: "scalar", T: 8, opt: true },
    { no: 6, name: "audio", kind: "message", T: IngressAudioOptions },
    { no: 7, name: "video", kind: "message", T: IngressVideoOptions },
    {
      no: 8,
      name: "room_name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 9,
      name: "participant_identity",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 10,
      name: "participant_name",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 14,
      name: "participant_metadata",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 11,
      name: "reusable",
      kind: "scalar",
      T: 8
      /* ScalarType.BOOL */
    },
    { no: 12, name: "state", kind: "message", T: IngressState },
    { no: 16, name: "enabled", kind: "scalar", T: 8, opt: true }
  ]
);
var IngressState = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.IngressState",
  () => [
    { no: 1, name: "status", kind: "enum", T: proto3.getEnumType(IngressState_Status) },
    {
      no: 2,
      name: "error",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 3, name: "video", kind: "message", T: InputVideoState },
    { no: 4, name: "audio", kind: "message", T: InputAudioState },
    {
      no: 5,
      name: "room_id",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 7,
      name: "started_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 8,
      name: "ended_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 10,
      name: "updated_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 9,
      name: "resource_id",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 6, name: "tracks", kind: "message", T: TrackInfo, repeated: true }
  ]
);
var IngressState_Status = /* @__PURE__ */ proto3.makeEnum(
  "livekit.IngressState.Status",
  [
    { no: 0, name: "ENDPOINT_INACTIVE" },
    { no: 1, name: "ENDPOINT_BUFFERING" },
    { no: 2, name: "ENDPOINT_PUBLISHING" },
    { no: 3, name: "ENDPOINT_ERROR" },
    { no: 4, name: "ENDPOINT_COMPLETE" }
  ]
);
var InputVideoState = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.InputVideoState",
  () => [
    {
      no: 1,
      name: "mime_type",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "average_bitrate",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    {
      no: 3,
      name: "width",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    {
      no: 4,
      name: "height",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    {
      no: 5,
      name: "framerate",
      kind: "scalar",
      T: 1
      /* ScalarType.DOUBLE */
    }
  ]
);
var InputAudioState = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.InputAudioState",
  () => [
    {
      no: 1,
      name: "mime_type",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 2,
      name: "average_bitrate",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    {
      no: 3,
      name: "channels",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    },
    {
      no: 4,
      name: "sample_rate",
      kind: "scalar",
      T: 13
      /* ScalarType.UINT32 */
    }
  ]
);
var WebhookEvent = /* @__PURE__ */ proto3.makeMessageType(
  "livekit.WebhookEvent",
  () => [
    {
      no: 1,
      name: "event",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    { no: 2, name: "room", kind: "message", T: Room },
    { no: 3, name: "participant", kind: "message", T: ParticipantInfo },
    { no: 9, name: "egress_info", kind: "message", T: EgressInfo },
    { no: 10, name: "ingress_info", kind: "message", T: IngressInfo },
    { no: 8, name: "track", kind: "message", T: TrackInfo },
    { no: 12, name: "job", kind: "message", T: Job },
    {
      no: 6,
      name: "id",
      kind: "scalar",
      T: 9
      /* ScalarType.STRING */
    },
    {
      no: 7,
      name: "created_at",
      kind: "scalar",
      T: 3
      /* ScalarType.INT64 */
    },
    {
      no: 11,
      name: "num_dropped",
      kind: "scalar",
      T: 5
      /* ScalarType.INT32 */
    },
    { no: 13, name: "room_end_reason", kind: "enum", T: proto3.getEnumType(RoomEndReason) }
  ]
);

// node_modules/jose/dist/node/esm/runtime/base64url.js
import { Buffer as Buffer2 } from "node:buffer";

// node_modules/jose/dist/node/esm/lib/buffer_utils.js
var encoder = new TextEncoder();
var decoder = new TextDecoder();
var MAX_INT32 = 2 ** 32;
function concat(...buffers) {
  const size = buffers.reduce((acc, { length }) => acc + length, 0);
  const buf = new Uint8Array(size);
  let i = 0;
  for (const buffer of buffers) {
    buf.set(buffer, i);
    i += buffer.length;
  }
  return buf;
}

// node_modules/jose/dist/node/esm/runtime/base64url.js
function normalize(input) {
  let encoded = input;
  if (encoded instanceof Uint8Array) {
    encoded = decoder.decode(encoded);
  }
  return encoded;
}
var encode = (input) => Buffer2.from(input).toString("base64url");
var decode = (input) => new Uint8Array(Buffer2.from(normalize(input), "base64url"));

// node_modules/jose/dist/node/esm/util/errors.js
var JOSEError = class extends Error {
  static code = "ERR_JOSE_GENERIC";
  code = "ERR_JOSE_GENERIC";
  constructor(message2, options) {
    super(message2, options);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
};
var JWTClaimValidationFailed = class extends JOSEError {
  static code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
  code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
  claim;
  reason;
  payload;
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } });
    this.claim = claim;
    this.reason = reason;
    this.payload = payload;
  }
};
var JWTExpired = class extends JOSEError {
  static code = "ERR_JWT_EXPIRED";
  code = "ERR_JWT_EXPIRED";
  claim;
  reason;
  payload;
  constructor(message2, payload, claim = "unspecified", reason = "unspecified") {
    super(message2, { cause: { claim, reason, payload } });
    this.claim = claim;
    this.reason = reason;
    this.payload = payload;
  }
};
var JOSEAlgNotAllowed = class extends JOSEError {
  static code = "ERR_JOSE_ALG_NOT_ALLOWED";
  code = "ERR_JOSE_ALG_NOT_ALLOWED";
};
var JOSENotSupported = class extends JOSEError {
  static code = "ERR_JOSE_NOT_SUPPORTED";
  code = "ERR_JOSE_NOT_SUPPORTED";
};
var JWSInvalid = class extends JOSEError {
  static code = "ERR_JWS_INVALID";
  code = "ERR_JWS_INVALID";
};
var JWTInvalid = class extends JOSEError {
  static code = "ERR_JWT_INVALID";
  code = "ERR_JWT_INVALID";
};
var JWSSignatureVerificationFailed = class extends JOSEError {
  static code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  constructor(message2 = "signature verification failed", options) {
    super(message2, options);
  }
};

// node_modules/jose/dist/node/esm/runtime/is_key_object.js
import * as util from "node:util";
var is_key_object_default = (obj) => util.types.isKeyObject(obj);

// node_modules/jose/dist/node/esm/runtime/webcrypto.js
import * as crypto2 from "node:crypto";
import * as util2 from "node:util";
var webcrypto2 = crypto2.webcrypto;
var webcrypto_default = webcrypto2;
var isCryptoKey = (key) => util2.types.isCryptoKey(key);

// node_modules/jose/dist/node/esm/lib/crypto_key.js
function unusable(name, prop = "algorithm.name") {
  return new TypeError(`CryptoKey does not support this operation, its ${prop} must be ${name}`);
}
function isAlgorithm(algorithm, name) {
  return algorithm.name === name;
}
function getHashLength(hash) {
  return parseInt(hash.name.slice(4), 10);
}
function getNamedCurve(alg) {
  switch (alg) {
    case "ES256":
      return "P-256";
    case "ES384":
      return "P-384";
    case "ES512":
      return "P-521";
    default:
      throw new Error("unreachable");
  }
}
function checkUsage(key, usages) {
  if (usages.length && !usages.some((expected) => key.usages.includes(expected))) {
    let msg = "CryptoKey does not support this operation, its usages must include ";
    if (usages.length > 2) {
      const last = usages.pop();
      msg += `one of ${usages.join(", ")}, or ${last}.`;
    } else if (usages.length === 2) {
      msg += `one of ${usages[0]} or ${usages[1]}.`;
    } else {
      msg += `${usages[0]}.`;
    }
    throw new TypeError(msg);
  }
}
function checkSigCryptoKey(key, alg, ...usages) {
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512": {
      if (!isAlgorithm(key.algorithm, "HMAC"))
        throw unusable("HMAC");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "RS256":
    case "RS384":
    case "RS512": {
      if (!isAlgorithm(key.algorithm, "RSASSA-PKCS1-v1_5"))
        throw unusable("RSASSA-PKCS1-v1_5");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "PS256":
    case "PS384":
    case "PS512": {
      if (!isAlgorithm(key.algorithm, "RSA-PSS"))
        throw unusable("RSA-PSS");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "EdDSA": {
      if (key.algorithm.name !== "Ed25519" && key.algorithm.name !== "Ed448") {
        throw unusable("Ed25519 or Ed448");
      }
      break;
    }
    case "Ed25519": {
      if (!isAlgorithm(key.algorithm, "Ed25519"))
        throw unusable("Ed25519");
      break;
    }
    case "ES256":
    case "ES384":
    case "ES512": {
      if (!isAlgorithm(key.algorithm, "ECDSA"))
        throw unusable("ECDSA");
      const expected = getNamedCurve(alg);
      const actual = key.algorithm.namedCurve;
      if (actual !== expected)
        throw unusable(expected, "algorithm.namedCurve");
      break;
    }
    default:
      throw new TypeError("CryptoKey does not support this operation");
  }
  checkUsage(key, usages);
}

// node_modules/jose/dist/node/esm/lib/invalid_key_input.js
function message(msg, actual, ...types4) {
  types4 = types4.filter(Boolean);
  if (types4.length > 2) {
    const last = types4.pop();
    msg += `one of type ${types4.join(", ")}, or ${last}.`;
  } else if (types4.length === 2) {
    msg += `one of type ${types4[0]} or ${types4[1]}.`;
  } else {
    msg += `of type ${types4[0]}.`;
  }
  if (actual == null) {
    msg += ` Received ${actual}`;
  } else if (typeof actual === "function" && actual.name) {
    msg += ` Received function ${actual.name}`;
  } else if (typeof actual === "object" && actual != null) {
    if (actual.constructor?.name) {
      msg += ` Received an instance of ${actual.constructor.name}`;
    }
  }
  return msg;
}
var invalid_key_input_default = (actual, ...types4) => {
  return message("Key must be ", actual, ...types4);
};
function withAlg(alg, actual, ...types4) {
  return message(`Key for the ${alg} algorithm must be `, actual, ...types4);
}

// node_modules/jose/dist/node/esm/runtime/is_key_like.js
var is_key_like_default = (key) => is_key_object_default(key) || isCryptoKey(key);
var types3 = ["KeyObject"];
if (globalThis.CryptoKey || webcrypto_default?.CryptoKey) {
  types3.push("CryptoKey");
}

// node_modules/jose/dist/node/esm/lib/is_disjoint.js
var isDisjoint = (...headers) => {
  const sources = headers.filter(Boolean);
  if (sources.length === 0 || sources.length === 1) {
    return true;
  }
  let acc;
  for (const header of sources) {
    const parameters = Object.keys(header);
    if (!acc || acc.size === 0) {
      acc = new Set(parameters);
      continue;
    }
    for (const parameter of parameters) {
      if (acc.has(parameter)) {
        return false;
      }
      acc.add(parameter);
    }
  }
  return true;
};
var is_disjoint_default = isDisjoint;

// node_modules/jose/dist/node/esm/lib/is_object.js
function isObjectLike(value) {
  return typeof value === "object" && value !== null;
}
function isObject(input) {
  if (!isObjectLike(input) || Object.prototype.toString.call(input) !== "[object Object]") {
    return false;
  }
  if (Object.getPrototypeOf(input) === null) {
    return true;
  }
  let proto = input;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return Object.getPrototypeOf(input) === proto;
}

// node_modules/jose/dist/node/esm/runtime/get_named_curve.js
import { KeyObject } from "node:crypto";

// node_modules/jose/dist/node/esm/lib/is_jwk.js
function isJWK(key) {
  return isObject(key) && typeof key.kty === "string";
}
function isPrivateJWK(key) {
  return key.kty !== "oct" && typeof key.d === "string";
}
function isPublicJWK(key) {
  return key.kty !== "oct" && typeof key.d === "undefined";
}
function isSecretJWK(key) {
  return isJWK(key) && key.kty === "oct" && typeof key.k === "string";
}

// node_modules/jose/dist/node/esm/runtime/get_named_curve.js
var namedCurveToJOSE = (namedCurve) => {
  switch (namedCurve) {
    case "prime256v1":
      return "P-256";
    case "secp384r1":
      return "P-384";
    case "secp521r1":
      return "P-521";
    case "secp256k1":
      return "secp256k1";
    default:
      throw new JOSENotSupported("Unsupported key curve for this operation");
  }
};
var getNamedCurve2 = (kee, raw) => {
  let key;
  if (isCryptoKey(kee)) {
    key = KeyObject.from(kee);
  } else if (is_key_object_default(kee)) {
    key = kee;
  } else if (isJWK(kee)) {
    return kee.crv;
  } else {
    throw new TypeError(invalid_key_input_default(kee, ...types3));
  }
  if (key.type === "secret") {
    throw new TypeError('only "private" or "public" type keys can be used for this operation');
  }
  switch (key.asymmetricKeyType) {
    case "ed25519":
    case "ed448":
      return `Ed${key.asymmetricKeyType.slice(2)}`;
    case "x25519":
    case "x448":
      return `X${key.asymmetricKeyType.slice(1)}`;
    case "ec": {
      const namedCurve = key.asymmetricKeyDetails.namedCurve;
      if (raw) {
        return namedCurve;
      }
      return namedCurveToJOSE(namedCurve);
    }
    default:
      throw new TypeError("Invalid asymmetric key type for this operation");
  }
};
var get_named_curve_default = getNamedCurve2;

// node_modules/jose/dist/node/esm/runtime/check_key_length.js
import { KeyObject as KeyObject2 } from "node:crypto";
var check_key_length_default = (key, alg) => {
  let modulusLength;
  try {
    if (key instanceof KeyObject2) {
      modulusLength = key.asymmetricKeyDetails?.modulusLength;
    } else {
      modulusLength = Buffer.from(key.n, "base64url").byteLength << 3;
    }
  } catch {
  }
  if (typeof modulusLength !== "number" || modulusLength < 2048) {
    throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
  }
};

// node_modules/jose/dist/node/esm/runtime/jwk_to_key.js
import { createPrivateKey, createPublicKey } from "node:crypto";
var parse = (key) => {
  if (key.d) {
    return createPrivateKey({ format: "jwk", key });
  }
  return createPublicKey({ format: "jwk", key });
};
var jwk_to_key_default = parse;

// node_modules/jose/dist/node/esm/key/import.js
async function importJWK(jwk, alg) {
  if (!isObject(jwk)) {
    throw new TypeError("JWK must be an object");
  }
  alg ||= jwk.alg;
  switch (jwk.kty) {
    case "oct":
      if (typeof jwk.k !== "string" || !jwk.k) {
        throw new TypeError('missing "k" (Key Value) Parameter value');
      }
      return decode(jwk.k);
    case "RSA":
      if ("oth" in jwk && jwk.oth !== void 0) {
        throw new JOSENotSupported('RSA JWK "oth" (Other Primes Info) Parameter value is not supported');
      }
    case "EC":
    case "OKP":
      return jwk_to_key_default({ ...jwk, alg });
    default:
      throw new JOSENotSupported('Unsupported "kty" (Key Type) Parameter value');
  }
}

// node_modules/jose/dist/node/esm/lib/check_key_type.js
var tag = (key) => key?.[Symbol.toStringTag];
var jwkMatchesOp = (alg, key, usage) => {
  if (key.use !== void 0 && key.use !== "sig") {
    throw new TypeError("Invalid key for this operation, when present its use must be sig");
  }
  if (key.key_ops !== void 0 && key.key_ops.includes?.(usage) !== true) {
    throw new TypeError(`Invalid key for this operation, when present its key_ops must include ${usage}`);
  }
  if (key.alg !== void 0 && key.alg !== alg) {
    throw new TypeError(`Invalid key for this operation, when present its alg must be ${alg}`);
  }
  return true;
};
var symmetricTypeCheck = (alg, key, usage, allowJwk) => {
  if (key instanceof Uint8Array)
    return;
  if (allowJwk && isJWK(key)) {
    if (isSecretJWK(key) && jwkMatchesOp(alg, key, usage))
      return;
    throw new TypeError(`JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present`);
  }
  if (!is_key_like_default(key)) {
    throw new TypeError(withAlg(alg, key, ...types3, "Uint8Array", allowJwk ? "JSON Web Key" : null));
  }
  if (key.type !== "secret") {
    throw new TypeError(`${tag(key)} instances for symmetric algorithms must be of type "secret"`);
  }
};
var asymmetricTypeCheck = (alg, key, usage, allowJwk) => {
  if (allowJwk && isJWK(key)) {
    switch (usage) {
      case "sign":
        if (isPrivateJWK(key) && jwkMatchesOp(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation be a private JWK`);
      case "verify":
        if (isPublicJWK(key) && jwkMatchesOp(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation be a public JWK`);
    }
  }
  if (!is_key_like_default(key)) {
    throw new TypeError(withAlg(alg, key, ...types3, allowJwk ? "JSON Web Key" : null));
  }
  if (key.type === "secret") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithms must not be of type "secret"`);
  }
  if (usage === "sign" && key.type === "public") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithm signing must be of type "private"`);
  }
  if (usage === "decrypt" && key.type === "public") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithm decryption must be of type "private"`);
  }
  if (key.algorithm && usage === "verify" && key.type === "private") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithm verifying must be of type "public"`);
  }
  if (key.algorithm && usage === "encrypt" && key.type === "private") {
    throw new TypeError(`${tag(key)} instances for asymmetric algorithm encryption must be of type "public"`);
  }
};
function checkKeyType(allowJwk, alg, key, usage) {
  const symmetric = alg.startsWith("HS") || alg === "dir" || alg.startsWith("PBES2") || /^A\d{3}(?:GCM)?KW$/.test(alg);
  if (symmetric) {
    symmetricTypeCheck(alg, key, usage, allowJwk);
  } else {
    asymmetricTypeCheck(alg, key, usage, allowJwk);
  }
}
var check_key_type_default = checkKeyType.bind(void 0, false);
var checkKeyTypeWithJwk = checkKeyType.bind(void 0, true);

// node_modules/jose/dist/node/esm/lib/validate_crit.js
function validateCrit(Err, recognizedDefault, recognizedOption, protectedHeader, joseHeader) {
  if (joseHeader.crit !== void 0 && protectedHeader?.crit === void 0) {
    throw new Err('"crit" (Critical) Header Parameter MUST be integrity protected');
  }
  if (!protectedHeader || protectedHeader.crit === void 0) {
    return /* @__PURE__ */ new Set();
  }
  if (!Array.isArray(protectedHeader.crit) || protectedHeader.crit.length === 0 || protectedHeader.crit.some((input) => typeof input !== "string" || input.length === 0)) {
    throw new Err('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
  }
  let recognized;
  if (recognizedOption !== void 0) {
    recognized = new Map([...Object.entries(recognizedOption), ...recognizedDefault.entries()]);
  } else {
    recognized = recognizedDefault;
  }
  for (const parameter of protectedHeader.crit) {
    if (!recognized.has(parameter)) {
      throw new JOSENotSupported(`Extension Header Parameter "${parameter}" is not recognized`);
    }
    if (joseHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" is missing`);
    }
    if (recognized.get(parameter) && protectedHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" MUST be integrity protected`);
    }
  }
  return new Set(protectedHeader.crit);
}
var validate_crit_default = validateCrit;

// node_modules/jose/dist/node/esm/lib/validate_algorithms.js
var validateAlgorithms = (option, algorithms) => {
  if (algorithms !== void 0 && (!Array.isArray(algorithms) || algorithms.some((s) => typeof s !== "string"))) {
    throw new TypeError(`"${option}" option must be an array of strings`);
  }
  if (!algorithms) {
    return void 0;
  }
  return new Set(algorithms);
};
var validate_algorithms_default = validateAlgorithms;

// node_modules/jose/dist/node/esm/runtime/verify.js
import * as crypto4 from "node:crypto";
import { promisify as promisify2 } from "node:util";

// node_modules/jose/dist/node/esm/runtime/dsa_digest.js
function dsaDigest(alg) {
  switch (alg) {
    case "PS256":
    case "RS256":
    case "ES256":
    case "ES256K":
      return "sha256";
    case "PS384":
    case "RS384":
    case "ES384":
      return "sha384";
    case "PS512":
    case "RS512":
    case "ES512":
      return "sha512";
    case "Ed25519":
    case "EdDSA":
      return void 0;
    default:
      throw new JOSENotSupported(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
  }
}

// node_modules/jose/dist/node/esm/runtime/node_key.js
import { constants, KeyObject as KeyObject3 } from "node:crypto";
var ecCurveAlgMap = /* @__PURE__ */ new Map([
  ["ES256", "P-256"],
  ["ES256K", "secp256k1"],
  ["ES384", "P-384"],
  ["ES512", "P-521"]
]);
function keyForCrypto(alg, key) {
  let asymmetricKeyType;
  let asymmetricKeyDetails;
  let isJWK2;
  if (key instanceof KeyObject3) {
    asymmetricKeyType = key.asymmetricKeyType;
    asymmetricKeyDetails = key.asymmetricKeyDetails;
  } else {
    isJWK2 = true;
    switch (key.kty) {
      case "RSA":
        asymmetricKeyType = "rsa";
        break;
      case "EC":
        asymmetricKeyType = "ec";
        break;
      case "OKP": {
        if (key.crv === "Ed25519") {
          asymmetricKeyType = "ed25519";
          break;
        }
        if (key.crv === "Ed448") {
          asymmetricKeyType = "ed448";
          break;
        }
        throw new TypeError("Invalid key for this operation, its crv must be Ed25519 or Ed448");
      }
      default:
        throw new TypeError("Invalid key for this operation, its kty must be RSA, OKP, or EC");
    }
  }
  let options;
  switch (alg) {
    case "Ed25519":
      if (asymmetricKeyType !== "ed25519") {
        throw new TypeError(`Invalid key for this operation, its asymmetricKeyType must be ed25519`);
      }
      break;
    case "EdDSA":
      if (!["ed25519", "ed448"].includes(asymmetricKeyType)) {
        throw new TypeError("Invalid key for this operation, its asymmetricKeyType must be ed25519 or ed448");
      }
      break;
    case "RS256":
    case "RS384":
    case "RS512":
      if (asymmetricKeyType !== "rsa") {
        throw new TypeError("Invalid key for this operation, its asymmetricKeyType must be rsa");
      }
      check_key_length_default(key, alg);
      break;
    case "PS256":
    case "PS384":
    case "PS512":
      if (asymmetricKeyType === "rsa-pss") {
        const { hashAlgorithm, mgf1HashAlgorithm, saltLength } = asymmetricKeyDetails;
        const length = parseInt(alg.slice(-3), 10);
        if (hashAlgorithm !== void 0 && (hashAlgorithm !== `sha${length}` || mgf1HashAlgorithm !== hashAlgorithm)) {
          throw new TypeError(`Invalid key for this operation, its RSA-PSS parameters do not meet the requirements of "alg" ${alg}`);
        }
        if (saltLength !== void 0 && saltLength > length >> 3) {
          throw new TypeError(`Invalid key for this operation, its RSA-PSS parameter saltLength does not meet the requirements of "alg" ${alg}`);
        }
      } else if (asymmetricKeyType !== "rsa") {
        throw new TypeError("Invalid key for this operation, its asymmetricKeyType must be rsa or rsa-pss");
      }
      check_key_length_default(key, alg);
      options = {
        padding: constants.RSA_PKCS1_PSS_PADDING,
        saltLength: constants.RSA_PSS_SALTLEN_DIGEST
      };
      break;
    case "ES256":
    case "ES256K":
    case "ES384":
    case "ES512": {
      if (asymmetricKeyType !== "ec") {
        throw new TypeError("Invalid key for this operation, its asymmetricKeyType must be ec");
      }
      const actual = get_named_curve_default(key);
      const expected = ecCurveAlgMap.get(alg);
      if (actual !== expected) {
        throw new TypeError(`Invalid key curve for the algorithm, its curve must be ${expected}, got ${actual}`);
      }
      options = { dsaEncoding: "ieee-p1363" };
      break;
    }
    default:
      throw new JOSENotSupported(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
  }
  if (isJWK2) {
    return { format: "jwk", key, ...options };
  }
  return options ? { ...options, key } : key;
}

// node_modules/jose/dist/node/esm/runtime/sign.js
import * as crypto3 from "node:crypto";
import { promisify } from "node:util";

// node_modules/jose/dist/node/esm/runtime/hmac_digest.js
function hmacDigest(alg) {
  switch (alg) {
    case "HS256":
      return "sha256";
    case "HS384":
      return "sha384";
    case "HS512":
      return "sha512";
    default:
      throw new JOSENotSupported(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
  }
}

// node_modules/jose/dist/node/esm/runtime/get_sign_verify_key.js
import { KeyObject as KeyObject4, createSecretKey } from "node:crypto";
function getSignVerifyKey(alg, key, usage) {
  if (key instanceof Uint8Array) {
    if (!alg.startsWith("HS")) {
      throw new TypeError(invalid_key_input_default(key, ...types3));
    }
    return createSecretKey(key);
  }
  if (key instanceof KeyObject4) {
    return key;
  }
  if (isCryptoKey(key)) {
    checkSigCryptoKey(key, alg, usage);
    return KeyObject4.from(key);
  }
  if (isJWK(key)) {
    if (alg.startsWith("HS")) {
      return createSecretKey(Buffer.from(key.k, "base64url"));
    }
    return key;
  }
  throw new TypeError(invalid_key_input_default(key, ...types3, "Uint8Array", "JSON Web Key"));
}

// node_modules/jose/dist/node/esm/runtime/sign.js
var oneShotSign = promisify(crypto3.sign);
var sign2 = async (alg, key, data) => {
  const k = getSignVerifyKey(alg, key, "sign");
  if (alg.startsWith("HS")) {
    const hmac = crypto3.createHmac(hmacDigest(alg), k);
    hmac.update(data);
    return hmac.digest();
  }
  return oneShotSign(dsaDigest(alg), data, keyForCrypto(alg, k));
};
var sign_default = sign2;

// node_modules/jose/dist/node/esm/runtime/verify.js
var oneShotVerify = promisify2(crypto4.verify);
var verify2 = async (alg, key, signature, data) => {
  const k = getSignVerifyKey(alg, key, "verify");
  if (alg.startsWith("HS")) {
    const expected = await sign_default(alg, k, data);
    const actual = signature;
    try {
      return crypto4.timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
  const algorithm = dsaDigest(alg);
  const keyInput = keyForCrypto(alg, k);
  try {
    return await oneShotVerify(algorithm, data, keyInput, signature);
  } catch {
    return false;
  }
};
var verify_default = verify2;

// node_modules/jose/dist/node/esm/jws/flattened/verify.js
async function flattenedVerify(jws, key, options) {
  if (!isObject(jws)) {
    throw new JWSInvalid("Flattened JWS must be an object");
  }
  if (jws.protected === void 0 && jws.header === void 0) {
    throw new JWSInvalid('Flattened JWS must have either of the "protected" or "header" members');
  }
  if (jws.protected !== void 0 && typeof jws.protected !== "string") {
    throw new JWSInvalid("JWS Protected Header incorrect type");
  }
  if (jws.payload === void 0) {
    throw new JWSInvalid("JWS Payload missing");
  }
  if (typeof jws.signature !== "string") {
    throw new JWSInvalid("JWS Signature missing or incorrect type");
  }
  if (jws.header !== void 0 && !isObject(jws.header)) {
    throw new JWSInvalid("JWS Unprotected Header incorrect type");
  }
  let parsedProt = {};
  if (jws.protected) {
    try {
      const protectedHeader = decode(jws.protected);
      parsedProt = JSON.parse(decoder.decode(protectedHeader));
    } catch {
      throw new JWSInvalid("JWS Protected Header is invalid");
    }
  }
  if (!is_disjoint_default(parsedProt, jws.header)) {
    throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  }
  const joseHeader = {
    ...parsedProt,
    ...jws.header
  };
  const extensions = validate_crit_default(JWSInvalid, /* @__PURE__ */ new Map([["b64", true]]), options?.crit, parsedProt, joseHeader);
  let b64 = true;
  if (extensions.has("b64")) {
    b64 = parsedProt.b64;
    if (typeof b64 !== "boolean") {
      throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
    }
  }
  const { alg } = joseHeader;
  if (typeof alg !== "string" || !alg) {
    throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  }
  const algorithms = options && validate_algorithms_default("algorithms", options.algorithms);
  if (algorithms && !algorithms.has(alg)) {
    throw new JOSEAlgNotAllowed('"alg" (Algorithm) Header Parameter value not allowed');
  }
  if (b64) {
    if (typeof jws.payload !== "string") {
      throw new JWSInvalid("JWS Payload must be a string");
    }
  } else if (typeof jws.payload !== "string" && !(jws.payload instanceof Uint8Array)) {
    throw new JWSInvalid("JWS Payload must be a string or an Uint8Array instance");
  }
  let resolvedKey = false;
  if (typeof key === "function") {
    key = await key(parsedProt, jws);
    resolvedKey = true;
    checkKeyTypeWithJwk(alg, key, "verify");
    if (isJWK(key)) {
      key = await importJWK(key, alg);
    }
  } else {
    checkKeyTypeWithJwk(alg, key, "verify");
  }
  const data = concat(encoder.encode(jws.protected ?? ""), encoder.encode("."), typeof jws.payload === "string" ? encoder.encode(jws.payload) : jws.payload);
  let signature;
  try {
    signature = decode(jws.signature);
  } catch {
    throw new JWSInvalid("Failed to base64url decode the signature");
  }
  const verified = await verify_default(alg, key, signature, data);
  if (!verified) {
    throw new JWSSignatureVerificationFailed();
  }
  let payload;
  if (b64) {
    try {
      payload = decode(jws.payload);
    } catch {
      throw new JWSInvalid("Failed to base64url decode the payload");
    }
  } else if (typeof jws.payload === "string") {
    payload = encoder.encode(jws.payload);
  } else {
    payload = jws.payload;
  }
  const result = { payload };
  if (jws.protected !== void 0) {
    result.protectedHeader = parsedProt;
  }
  if (jws.header !== void 0) {
    result.unprotectedHeader = jws.header;
  }
  if (resolvedKey) {
    return { ...result, key };
  }
  return result;
}

// node_modules/jose/dist/node/esm/jws/compact/verify.js
async function compactVerify(jws, key, options) {
  if (jws instanceof Uint8Array) {
    jws = decoder.decode(jws);
  }
  if (typeof jws !== "string") {
    throw new JWSInvalid("Compact JWS must be a string or Uint8Array");
  }
  const { 0: protectedHeader, 1: payload, 2: signature, length } = jws.split(".");
  if (length !== 3) {
    throw new JWSInvalid("Invalid Compact JWS");
  }
  const verified = await flattenedVerify({ payload, protected: protectedHeader, signature }, key, options);
  const result = { payload: verified.payload, protectedHeader: verified.protectedHeader };
  if (typeof key === "function") {
    return { ...result, key: verified.key };
  }
  return result;
}

// node_modules/jose/dist/node/esm/lib/epoch.js
var epoch_default = (date) => Math.floor(date.getTime() / 1e3);

// node_modules/jose/dist/node/esm/lib/secs.js
var minute = 60;
var hour = minute * 60;
var day = hour * 24;
var week = day * 7;
var year = day * 365.25;
var REGEX = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
var secs_default = (str) => {
  const matched = REGEX.exec(str);
  if (!matched || matched[4] && matched[1]) {
    throw new TypeError("Invalid time period format");
  }
  const value = parseFloat(matched[2]);
  const unit = matched[3].toLowerCase();
  let numericDate;
  switch (unit) {
    case "sec":
    case "secs":
    case "second":
    case "seconds":
    case "s":
      numericDate = Math.round(value);
      break;
    case "minute":
    case "minutes":
    case "min":
    case "mins":
    case "m":
      numericDate = Math.round(value * minute);
      break;
    case "hour":
    case "hours":
    case "hr":
    case "hrs":
    case "h":
      numericDate = Math.round(value * hour);
      break;
    case "day":
    case "days":
    case "d":
      numericDate = Math.round(value * day);
      break;
    case "week":
    case "weeks":
    case "w":
      numericDate = Math.round(value * week);
      break;
    default:
      numericDate = Math.round(value * year);
      break;
  }
  if (matched[1] === "-" || matched[4] === "ago") {
    return -numericDate;
  }
  return numericDate;
};

// node_modules/jose/dist/node/esm/lib/jwt_claims_set.js
var normalizeTyp = (value) => value.toLowerCase().replace(/^application\//, "");
var checkAudiencePresence = (audPayload, audOption) => {
  if (typeof audPayload === "string") {
    return audOption.includes(audPayload);
  }
  if (Array.isArray(audPayload)) {
    return audOption.some(Set.prototype.has.bind(new Set(audPayload)));
  }
  return false;
};
var jwt_claims_set_default = (protectedHeader, encodedPayload, options = {}) => {
  let payload;
  try {
    payload = JSON.parse(decoder.decode(encodedPayload));
  } catch {
  }
  if (!isObject(payload)) {
    throw new JWTInvalid("JWT Claims Set must be a top-level JSON object");
  }
  const { typ } = options;
  if (typ && (typeof protectedHeader.typ !== "string" || normalizeTyp(protectedHeader.typ) !== normalizeTyp(typ))) {
    throw new JWTClaimValidationFailed('unexpected "typ" JWT header value', payload, "typ", "check_failed");
  }
  const { requiredClaims = [], issuer, subject, audience, maxTokenAge } = options;
  const presenceCheck = [...requiredClaims];
  if (maxTokenAge !== void 0)
    presenceCheck.push("iat");
  if (audience !== void 0)
    presenceCheck.push("aud");
  if (subject !== void 0)
    presenceCheck.push("sub");
  if (issuer !== void 0)
    presenceCheck.push("iss");
  for (const claim of new Set(presenceCheck.reverse())) {
    if (!(claim in payload)) {
      throw new JWTClaimValidationFailed(`missing required "${claim}" claim`, payload, claim, "missing");
    }
  }
  if (issuer && !(Array.isArray(issuer) ? issuer : [issuer]).includes(payload.iss)) {
    throw new JWTClaimValidationFailed('unexpected "iss" claim value', payload, "iss", "check_failed");
  }
  if (subject && payload.sub !== subject) {
    throw new JWTClaimValidationFailed('unexpected "sub" claim value', payload, "sub", "check_failed");
  }
  if (audience && !checkAudiencePresence(payload.aud, typeof audience === "string" ? [audience] : audience)) {
    throw new JWTClaimValidationFailed('unexpected "aud" claim value', payload, "aud", "check_failed");
  }
  let tolerance;
  switch (typeof options.clockTolerance) {
    case "string":
      tolerance = secs_default(options.clockTolerance);
      break;
    case "number":
      tolerance = options.clockTolerance;
      break;
    case "undefined":
      tolerance = 0;
      break;
    default:
      throw new TypeError("Invalid clockTolerance option type");
  }
  const { currentDate } = options;
  const now = epoch_default(currentDate || /* @__PURE__ */ new Date());
  if ((payload.iat !== void 0 || maxTokenAge) && typeof payload.iat !== "number") {
    throw new JWTClaimValidationFailed('"iat" claim must be a number', payload, "iat", "invalid");
  }
  if (payload.nbf !== void 0) {
    if (typeof payload.nbf !== "number") {
      throw new JWTClaimValidationFailed('"nbf" claim must be a number', payload, "nbf", "invalid");
    }
    if (payload.nbf > now + tolerance) {
      throw new JWTClaimValidationFailed('"nbf" claim timestamp check failed', payload, "nbf", "check_failed");
    }
  }
  if (payload.exp !== void 0) {
    if (typeof payload.exp !== "number") {
      throw new JWTClaimValidationFailed('"exp" claim must be a number', payload, "exp", "invalid");
    }
    if (payload.exp <= now - tolerance) {
      throw new JWTExpired('"exp" claim timestamp check failed', payload, "exp", "check_failed");
    }
  }
  if (maxTokenAge) {
    const age = now - payload.iat;
    const max = typeof maxTokenAge === "number" ? maxTokenAge : secs_default(maxTokenAge);
    if (age - tolerance > max) {
      throw new JWTExpired('"iat" claim timestamp check failed (too far in the past)', payload, "iat", "check_failed");
    }
    if (age < 0 - tolerance) {
      throw new JWTClaimValidationFailed('"iat" claim timestamp check failed (it should be in the past)', payload, "iat", "check_failed");
    }
  }
  return payload;
};

// node_modules/jose/dist/node/esm/jwt/verify.js
async function jwtVerify(jwt, key, options) {
  const verified = await compactVerify(jwt, key, options);
  if (verified.protectedHeader.crit?.includes("b64") && verified.protectedHeader.b64 === false) {
    throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
  }
  const payload = jwt_claims_set_default(verified.protectedHeader, verified.payload, options);
  const result = { payload, protectedHeader: verified.protectedHeader };
  if (typeof key === "function") {
    return { ...result, key: verified.key };
  }
  return result;
}

// node_modules/jose/dist/node/esm/jws/flattened/sign.js
var FlattenedSign = class {
  _payload;
  _protectedHeader;
  _unprotectedHeader;
  constructor(payload) {
    if (!(payload instanceof Uint8Array)) {
      throw new TypeError("payload must be an instance of Uint8Array");
    }
    this._payload = payload;
  }
  setProtectedHeader(protectedHeader) {
    if (this._protectedHeader) {
      throw new TypeError("setProtectedHeader can only be called once");
    }
    this._protectedHeader = protectedHeader;
    return this;
  }
  setUnprotectedHeader(unprotectedHeader) {
    if (this._unprotectedHeader) {
      throw new TypeError("setUnprotectedHeader can only be called once");
    }
    this._unprotectedHeader = unprotectedHeader;
    return this;
  }
  async sign(key, options) {
    if (!this._protectedHeader && !this._unprotectedHeader) {
      throw new JWSInvalid("either setProtectedHeader or setUnprotectedHeader must be called before #sign()");
    }
    if (!is_disjoint_default(this._protectedHeader, this._unprotectedHeader)) {
      throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
    }
    const joseHeader = {
      ...this._protectedHeader,
      ...this._unprotectedHeader
    };
    const extensions = validate_crit_default(JWSInvalid, /* @__PURE__ */ new Map([["b64", true]]), options?.crit, this._protectedHeader, joseHeader);
    let b64 = true;
    if (extensions.has("b64")) {
      b64 = this._protectedHeader.b64;
      if (typeof b64 !== "boolean") {
        throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
      }
    }
    const { alg } = joseHeader;
    if (typeof alg !== "string" || !alg) {
      throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
    }
    checkKeyTypeWithJwk(alg, key, "sign");
    let payload = this._payload;
    if (b64) {
      payload = encoder.encode(encode(payload));
    }
    let protectedHeader;
    if (this._protectedHeader) {
      protectedHeader = encoder.encode(encode(JSON.stringify(this._protectedHeader)));
    } else {
      protectedHeader = encoder.encode("");
    }
    const data = concat(protectedHeader, encoder.encode("."), payload);
    const signature = await sign_default(alg, key, data);
    const jws = {
      signature: encode(signature),
      payload: ""
    };
    if (b64) {
      jws.payload = decoder.decode(payload);
    }
    if (this._unprotectedHeader) {
      jws.header = this._unprotectedHeader;
    }
    if (this._protectedHeader) {
      jws.protected = decoder.decode(protectedHeader);
    }
    return jws;
  }
};

// node_modules/jose/dist/node/esm/jws/compact/sign.js
var CompactSign = class {
  _flattened;
  constructor(payload) {
    this._flattened = new FlattenedSign(payload);
  }
  setProtectedHeader(protectedHeader) {
    this._flattened.setProtectedHeader(protectedHeader);
    return this;
  }
  async sign(key, options) {
    const jws = await this._flattened.sign(key, options);
    if (jws.payload === void 0) {
      throw new TypeError("use the flattened module for creating JWS with b64: false");
    }
    return `${jws.protected}.${jws.payload}.${jws.signature}`;
  }
};

// node_modules/jose/dist/node/esm/jwt/produce.js
function validateInput(label, input) {
  if (!Number.isFinite(input)) {
    throw new TypeError(`Invalid ${label} input`);
  }
  return input;
}
var ProduceJWT = class {
  _payload;
  constructor(payload = {}) {
    if (!isObject(payload)) {
      throw new TypeError("JWT Claims Set MUST be an object");
    }
    this._payload = payload;
  }
  setIssuer(issuer) {
    this._payload = { ...this._payload, iss: issuer };
    return this;
  }
  setSubject(subject) {
    this._payload = { ...this._payload, sub: subject };
    return this;
  }
  setAudience(audience) {
    this._payload = { ...this._payload, aud: audience };
    return this;
  }
  setJti(jwtId) {
    this._payload = { ...this._payload, jti: jwtId };
    return this;
  }
  setNotBefore(input) {
    if (typeof input === "number") {
      this._payload = { ...this._payload, nbf: validateInput("setNotBefore", input) };
    } else if (input instanceof Date) {
      this._payload = { ...this._payload, nbf: validateInput("setNotBefore", epoch_default(input)) };
    } else {
      this._payload = { ...this._payload, nbf: epoch_default(/* @__PURE__ */ new Date()) + secs_default(input) };
    }
    return this;
  }
  setExpirationTime(input) {
    if (typeof input === "number") {
      this._payload = { ...this._payload, exp: validateInput("setExpirationTime", input) };
    } else if (input instanceof Date) {
      this._payload = { ...this._payload, exp: validateInput("setExpirationTime", epoch_default(input)) };
    } else {
      this._payload = { ...this._payload, exp: epoch_default(/* @__PURE__ */ new Date()) + secs_default(input) };
    }
    return this;
  }
  setIssuedAt(input) {
    if (typeof input === "undefined") {
      this._payload = { ...this._payload, iat: epoch_default(/* @__PURE__ */ new Date()) };
    } else if (input instanceof Date) {
      this._payload = { ...this._payload, iat: validateInput("setIssuedAt", epoch_default(input)) };
    } else if (typeof input === "string") {
      this._payload = {
        ...this._payload,
        iat: validateInput("setIssuedAt", epoch_default(/* @__PURE__ */ new Date()) + secs_default(input))
      };
    } else {
      this._payload = { ...this._payload, iat: validateInput("setIssuedAt", input) };
    }
    return this;
  }
};

// node_modules/jose/dist/node/esm/jwt/sign.js
var SignJWT = class extends ProduceJWT {
  _protectedHeader;
  setProtectedHeader(protectedHeader) {
    this._protectedHeader = protectedHeader;
    return this;
  }
  async sign(key, options) {
    const sig = new CompactSign(encoder.encode(JSON.stringify(this._payload)));
    sig.setProtectedHeader(this._protectedHeader);
    if (Array.isArray(this._protectedHeader?.crit) && this._protectedHeader.crit.includes("b64") && this._protectedHeader.b64 === false) {
      throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
    }
    return sig.sign(key, options);
  }
};

// node_modules/livekit-server-sdk/dist/grants.js
function trackSourceToString(source) {
  switch (source) {
    case TrackSource.CAMERA:
      return "camera";
    case TrackSource.MICROPHONE:
      return "microphone";
    case TrackSource.SCREEN_SHARE:
      return "screen_share";
    case TrackSource.SCREEN_SHARE_AUDIO:
      return "screen_share_audio";
    default:
      throw new TypeError(`Cannot convert TrackSource ${source} to string`);
  }
}
function claimsToJwtPayload(grant) {
  var _a;
  const claim = { ...grant };
  if (Array.isArray((_a = claim.video) == null ? void 0 : _a.canPublishSources)) {
    claim.video.canPublishSources = claim.video.canPublishSources.map(trackSourceToString);
  }
  return claim;
}

// node_modules/livekit-server-sdk/dist/AccessToken.js
var defaultTTL = `6h`;
var defaultClockToleranceSeconds = 10;
var AccessToken = class {
  /**
   * Creates a new AccessToken
   * @param apiKey - API Key, can be set in env LIVEKIT_API_KEY
   * @param apiSecret - Secret, can be set in env LIVEKIT_API_SECRET
   */
  constructor(apiKey, apiSecret, options) {
    if (!apiKey) {
      apiKey = process.env.LIVEKIT_API_KEY;
    }
    if (!apiSecret) {
      apiSecret = process.env.LIVEKIT_API_SECRET;
    }
    if (!apiKey || !apiSecret) {
      throw Error("api-key and api-secret must be set");
    } else if (typeof document !== "undefined") {
      console.error(
        "You should not include your API secret in your web client bundle.\n\nYour web client should request a token from your backend server which should then use the API secret to generate a token. See https://docs.livekit.io/client/connect/"
      );
    }
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.grants = {};
    this.identity = options == null ? void 0 : options.identity;
    this.ttl = (options == null ? void 0 : options.ttl) || defaultTTL;
    if (typeof this.ttl === "number") {
      this.ttl = `${this.ttl}s`;
    }
    if (options == null ? void 0 : options.metadata) {
      this.metadata = options.metadata;
    }
    if (options == null ? void 0 : options.attributes) {
      this.attributes = options.attributes;
    }
    if (options == null ? void 0 : options.name) {
      this.name = options.name;
    }
  }
  /**
   * Adds a video grant to this token.
   * @param grant -
   */
  addGrant(grant) {
    this.grants.video = { ...this.grants.video ?? {}, ...grant };
  }
  /**
   * Adds an inference grant to this token.
   * @param grant -
   */
  addInferenceGrant(grant) {
    this.grants.inference = { ...this.grants.inference ?? {}, ...grant };
  }
  /**
   * Adds a SIP grant to this token.
   * @param grant -
   */
  addSIPGrant(grant) {
    this.grants.sip = { ...this.grants.sip ?? {}, ...grant };
  }
  /**
   * Adds an observability grant to this token.
   * @param grant -
   */
  addObservabilityGrant(grant) {
    this.grants.observability = { ...this.grants.observability ?? {}, ...grant };
  }
  get name() {
    return this.grants.name;
  }
  set name(name) {
    this.grants.name = name;
  }
  get metadata() {
    return this.grants.metadata;
  }
  /**
   * Set metadata to be passed to the Participant, used only when joining the room
   */
  set metadata(md) {
    this.grants.metadata = md;
  }
  get attributes() {
    return this.grants.attributes;
  }
  set attributes(attrs) {
    this.grants.attributes = attrs;
  }
  get kind() {
    return this.grants.kind;
  }
  set kind(kind) {
    this.grants.kind = kind;
  }
  get sha256() {
    return this.grants.sha256;
  }
  set sha256(sha) {
    this.grants.sha256 = sha;
  }
  get roomPreset() {
    return this.grants.roomPreset;
  }
  set roomPreset(preset) {
    this.grants.roomPreset = preset;
  }
  get roomConfig() {
    return this.grants.roomConfig;
  }
  set roomConfig(config) {
    this.grants.roomConfig = config;
  }
  /**
   * @returns JWT encoded token
   */
  async toJwt() {
    var _a;
    const secret = new TextEncoder().encode(this.apiSecret);
    const jwt = new SignJWT(claimsToJwtPayload(this.grants)).setProtectedHeader({ alg: "HS256" }).setIssuer(this.apiKey).setExpirationTime(this.ttl).setNotBefore(/* @__PURE__ */ new Date());
    if (this.identity) {
      jwt.setSubject(this.identity);
    } else if ((_a = this.grants.video) == null ? void 0 : _a.roomJoin) {
      throw Error("identity is required for join but not set");
    }
    return jwt.sign(secret);
  }
};
var TokenVerifier = class {
  constructor(apiKey, apiSecret) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }
  async verify(token, clockTolerance = defaultClockToleranceSeconds) {
    const secret = new TextEncoder().encode(this.apiSecret);
    const { payload } = await jwtVerify(token, secret, {
      issuer: this.apiKey,
      clockTolerance,
      // First-party minters always set exp. Without this, a hand-rolled token
      // with a valid signature and no exp verifies forever (livekit/protocol#1706).
      requiredClaims: ["exp"]
    });
    if (!payload) {
      throw Error("invalid token");
    }
    return payload;
  }
};

// node_modules/livekit-server-sdk/dist/version.js
var SDK_VERSION = "2.19.2";

// node_modules/livekit-server-sdk/dist/TwirpRPC.js
var USER_AGENT = `livekit-server-sdk-node/${SDK_VERSION}`;

// node_modules/livekit-server-sdk/dist/crypto/digest.js
async function digest(data) {
  var _a;
  if (!((_a = globalThis.crypto) == null ? void 0 : _a.subtle)) {
    throw new Error("Web Crypto API is required (globalThis.crypto.subtle)");
  }
  const encoder2 = new TextEncoder();
  return crypto.subtle.digest("SHA-256", encoder2.encode(data));
}

// node_modules/livekit-server-sdk/dist/WebhookReceiver.js
var WebhookEvent2 = class _WebhookEvent extends WebhookEvent {
  constructor() {
    super(...arguments);
    this.event = "";
  }
  static fromBinary(bytes, options) {
    return new _WebhookEvent().fromBinary(bytes, options);
  }
  static fromJson(jsonValue, options) {
    return new _WebhookEvent().fromJson(jsonValue, options);
  }
  static fromJsonString(jsonString, options) {
    return new _WebhookEvent().fromJsonString(jsonString, options);
  }
};
var WebhookReceiver = class {
  constructor(apiKey, apiSecret) {
    this.verifier = new TokenVerifier(apiKey, apiSecret);
  }
  /**
   * @param body - string of the posted body
   * @param authHeader - `Authorization` header from the request
   * @param skipAuth - true to skip auth validation
   * @param clockTolerance - How much tolerance to allow for checks against the auth header to be skewed from the claims
   * @returns The processed webhook event
   */
  async receive(body, authHeader, skipAuth = false, clockTolerance) {
    if (!skipAuth) {
      if (!authHeader) {
        throw new Error("authorization header is empty");
      }
      const claims = await this.verifier.verify(authHeader, clockTolerance);
      const hash = await digest(body);
      const hashDecoded = btoa(
        Array.from(new Uint8Array(hash)).map((v) => String.fromCharCode(v)).join("")
      );
      if (claims.sha256 !== hashDecoded) {
        throw new Error("sha256 checksum of body does not match");
      }
    }
    return WebhookEvent2.fromJson(JSON.parse(body), { ignoreUnknownFields: true });
  }
};

// handler.mjs
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand
} from "@aws-sdk/lib-dynamodb";
var region = process.env.AWS_REGION ?? "ca-central-1";
var LIVEKIT_URL = process.env.LIVEKIT_URL ?? "";
var LIVEKIT_SECRET_ARN = process.env.LIVEKIT_SECRET_ARN;
var SIMLI_SECRET_ARN = process.env.SIMLI_SECRET_ARN;
var SESSION_LOCK_TABLE = process.env.SESSION_LOCK_TABLE;
var MOOT_ROOM_NAME = process.env.MOOT_ROOM_NAME ?? "mootcourt";
var SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS ?? "900");
var SIMLI_COMPOSE_TOKEN_URL = "https://api.simli.ai/compose/token";
var SIMLI_REQUEST_TIMEOUT_MS = 1e4;
var DEFAULT_MAX_SESSION_LENGTH = 600;
var DEFAULT_MAX_IDLE_TIME = 180;
var secretsClient = new SecretsManagerClient({ region });
var ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
var _livekitCreds;
var _simliKey;
async function getSecretString(arn) {
  const out = await secretsClient.send(new GetSecretValueCommand({ SecretId: arn }));
  return out.SecretString ?? "";
}
async function getLivekitCreds() {
  if (!_livekitCreds) {
    _livekitCreds = JSON.parse(await getSecretString(LIVEKIT_SECRET_ARN));
  }
  return _livekitCreds;
}
async function getSimliKey() {
  if (_simliKey === void 0) {
    _simliKey = await getSecretString(SIMLI_SECRET_ARN);
  }
  return _simliKey;
}
function json(statusCode, payload, extraHeaders = {}) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: JSON.stringify(payload)
  };
}
async function acquireLock(room, identity) {
  const now = Math.floor(Date.now() / 1e3);
  try {
    await ddb.send(
      new PutCommand({
        TableName: SESSION_LOCK_TABLE,
        Item: {
          room,
          identity,
          acquiredAt: now,
          expiresAt: now + SESSION_TTL_SECONDS
        },
        // Acquire only if no live lock exists: either no item, or an item whose
        // TTL already passed (DynamoDB TTL deletion is best-effort/delayed, so we
        // check expiresAt explicitly rather than trust the sweep).
        ConditionExpression: "attribute_not_exists(room) OR expiresAt < :now",
        ExpressionAttributeValues: { ":now": now }
      })
    );
    return true;
  } catch (err) {
    if (err?.name === "ConditionalCheckFailedException") return false;
    throw err;
  }
}
async function releaseLock(room) {
  await ddb.send(new DeleteCommand({ TableName: SESSION_LOCK_TABLE, Key: { room } }));
}
async function handleToken(event) {
  if (!LIVEKIT_URL) {
    return json(500, { detail: "LIVEKIT_URL not configured" });
  }
  const qs = event.queryStringParameters ?? {};
  const room = qs.room || MOOT_ROOM_NAME;
  const identity = qs.identity || `counsel-${randomUUID2().slice(0, 8)}`;
  const acquired = await acquireLock(room, identity);
  if (!acquired) {
    return json(409, {
      detail: "A MootCourt session is already in progress. Only one live session is allowed at a time."
    });
  }
  try {
    const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = await getLivekitCreds();
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, { identity, name: identity });
    at.addGrant({
      roomJoin: true,
      room,
      canPublish: true,
      // publish the mic
      canSubscribe: true
      // hear the judge's TTS track
    });
    const token = await at.toJwt();
    return json(200, { token, url: LIVEKIT_URL, room, identity });
  } catch (err) {
    await releaseLock(room).catch(() => {
    });
    console.error("token mint failed:", err);
    return json(502, { detail: "Failed to mint LiveKit token" });
  }
}
async function handleSimliToken(event) {
  const simliKey = await getSimliKey();
  if (!simliKey) {
    return json(500, { detail: "SIMLI_API_KEY not configured" });
  }
  let body;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf-8") : event.body;
    body = JSON.parse(raw ?? "{}");
  } catch {
    return json(400, { detail: "Request body must be valid JSON" });
  }
  if (!body.faceId || typeof body.faceId !== "string") {
    return json(400, { detail: "faceId is required" });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SIMLI_REQUEST_TIMEOUT_MS);
  let resp;
  try {
    resp = await fetch(SIMLI_COMPOSE_TOKEN_URL, {
      method: "POST",
      // Simli's current API requires the x-simli-api-key header. The raw PCM16 /
      // 16 kHz / mono seam means apiVersion + audioInputFormat must be pinned, or
      // Simli misreads the bytes and lip-sync sticks (matches token_server.py).
      headers: { "Content-Type": "application/json", "x-simli-api-key": simliKey },
      body: JSON.stringify({
        faceId: body.faceId,
        apiVersion: "v2",
        audioInputFormat: "pcm16",
        handleSilence: false,
        // we drive audio ourselves
        maxSessionLength: body.maxSessionLength || DEFAULT_MAX_SESSION_LENGTH,
        maxIdleTime: body.maxIdleTime || DEFAULT_MAX_IDLE_TIME
      }),
      signal: controller.signal
    });
  } catch (err) {
    console.error("Simli /compose/token request failed to send:", err);
    return json(502, { detail: "Upstream Simli token request failed" });
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error(`Simli /compose/token returned ${resp.status} for faceId=${body.faceId}: ${text.slice(0, 500)}`);
    return json(502, { detail: "Upstream Simli token request failed" });
  }
  let sessionToken;
  try {
    const data = await resp.json();
    sessionToken = data.session_token;
  } catch (err) {
    console.error("Simli returned 2xx but no session_token:", err);
    return json(502, { detail: "Upstream Simli token request failed" });
  }
  if (!sessionToken) {
    return json(502, { detail: "Upstream Simli token request failed" });
  }
  return json(200, { session_token: sessionToken });
}
async function handleWebhook(event) {
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf-8") : event.body ?? "";
  const authHeader = event.headers?.authorization ?? event.headers?.Authorization ?? "";
  const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = await getLivekitCreds();
  const receiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
  let webhookEvent;
  try {
    webhookEvent = await receiver.receive(raw, authHeader);
  } catch (err) {
    console.error("webhook verification failed:", err);
    return json(401, { detail: "Invalid webhook signature" });
  }
  const roomName = webhookEvent?.room?.name;
  if (webhookEvent.event === "room_finished" && roomName === MOOT_ROOM_NAME) {
    await releaseLock(MOOT_ROOM_NAME).catch((e) => console.error("releaseLock failed:", e));
    console.log(`lock released on room_finished for room ${roomName}`);
  }
  return json(200, { received: true });
}
var handler = async (event) => {
  const method = event.requestContext?.http?.method;
  const path = event.requestContext?.http?.path ?? event.rawPath ?? "";
  if (method === "OPTIONS") return json(200, {});
  try {
    if (method === "GET" && path.endsWith("/token")) return await handleToken(event);
    if (method === "POST" && path.endsWith("/simli-token")) return await handleSimliToken(event);
    if (method === "POST" && path.endsWith("/livekit-webhook")) return await handleWebhook(event);
    return json(404, { detail: "Not found" });
  } catch (err) {
    console.error("unhandled error:", err);
    return json(500, { detail: "Internal error" });
  }
};
export {
  handler
};
