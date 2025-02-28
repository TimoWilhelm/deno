// Copyright 2018-2023 the Deno authors. All rights reserved. MIT license.

// @ts-check
/// <reference path="../../core/lib.deno_core.d.ts" />
/// <reference path="../../core/internal.d.ts" />
/// <reference path="../webidl/internal.d.ts" />
/// <reference path="../fetch/lib.deno_fetch.d.ts" />
/// <reference path="../web/internal.d.ts" />
/// <reference path="../web/lib.deno_web.d.ts" />
/// <reference lib="esnext" />

const core = globalThis.Deno.core;
const ops = core.ops;
import * as webidl from "ext:deno_webidl/00_webidl.js";
const primordials = globalThis.__bootstrap.primordials;
const {
  PromiseReject,
  PromiseResolve,
  // TODO(lucacasonato): add SharedArrayBuffer to primordials
  // SharedArrayBufferPrototype
  StringPrototypeCharCodeAt,
  StringPrototypeSlice,
  TypedArrayPrototypeSubarray,
  Uint8Array,
  ObjectPrototypeIsPrototypeOf,
  ArrayBufferIsView,
  Uint32Array,
} = primordials;

class TextDecoder {
  /** @type {string} */
  #encoding;
  /** @type {boolean} */
  #fatal;
  /** @type {boolean} */
  #ignoreBOM;
  /** @type {boolean} */
  #utf8SinglePass;

  /** @type {number | null} */
  #rid = null;

  /**
   * @param {string} label
   * @param {TextDecoderOptions} options
   */
  constructor(label = "utf-8", options = {}) {
    const prefix = "Failed to construct 'TextDecoder'";
    label = webidl.converters.DOMString(label, {
      prefix,
      context: "Argument 1",
    });
    options = webidl.converters.TextDecoderOptions(options, {
      prefix,
      context: "Argument 2",
    });
    const encoding = ops.op_encoding_normalize_label(label);
    this.#encoding = encoding;
    this.#fatal = options.fatal;
    this.#ignoreBOM = options.ignoreBOM;
    this.#utf8SinglePass = encoding === "utf-8" && !options.fatal;
    this[webidl.brand] = webidl.brand;
  }

  /** @returns {string} */
  get encoding() {
    webidl.assertBranded(this, TextDecoderPrototype);
    return this.#encoding;
  }

  /** @returns {boolean} */
  get fatal() {
    webidl.assertBranded(this, TextDecoderPrototype);
    return this.#fatal;
  }

  /** @returns {boolean} */
  get ignoreBOM() {
    webidl.assertBranded(this, TextDecoderPrototype);
    return this.#ignoreBOM;
  }

  /**
   * @param {BufferSource} [input]
   * @param {TextDecodeOptions} options
   */
  decode(input = new Uint8Array(), options = undefined) {
    webidl.assertBranded(this, TextDecoderPrototype);
    const prefix = "Failed to execute 'decode' on 'TextDecoder'";
    if (input !== undefined) {
      input = webidl.converters.BufferSource(input, {
        prefix,
        context: "Argument 1",
        allowShared: true,
      });
    }
    let stream = false;
    if (options !== undefined) {
      options = webidl.converters.TextDecodeOptions(options, {
        prefix,
        context: "Argument 2",
      });
      stream = options.stream;
    }

    try {
      // Note from spec: implementations are strongly encouraged to use an implementation strategy that avoids this copy.
      // When doing so they will have to make sure that changes to input do not affect future calls to decode().
      if (
        ObjectPrototypeIsPrototypeOf(
          // deno-lint-ignore prefer-primordials
          SharedArrayBuffer.prototype,
          input || input.buffer,
        )
      ) {
        // We clone the data into a non-shared ArrayBuffer so we can pass it
        // to Rust.
        // `input` is now a Uint8Array, and calling the TypedArray constructor
        // with a TypedArray argument copies the data.
        if (ArrayBufferIsView(input)) {
          input = new Uint8Array(
            input.buffer,
            input.byteOffset,
            input.byteLength,
          );
        } else {
          input = new Uint8Array(input);
        }
      }

      // Fast path for single pass encoding.
      if (!stream && this.#rid === null) {
        // Fast path for utf8 single pass encoding.
        if (this.#utf8SinglePass) {
          return ops.op_encoding_decode_utf8(input, this.#ignoreBOM);
        }

        return ops.op_encoding_decode_single(
          input,
          this.#encoding,
          this.#fatal,
          this.#ignoreBOM,
        );
      }

      if (this.#rid === null) {
        this.#rid = ops.op_encoding_new_decoder(
          this.#encoding,
          this.#fatal,
          this.#ignoreBOM,
        );
      }
      return ops.op_encoding_decode(input, this.#rid, stream);
    } finally {
      if (!stream && this.#rid !== null) {
        core.close(this.#rid);
        this.#rid = null;
      }
    }
  }
}

webidl.configurePrototype(TextDecoder);
const TextDecoderPrototype = TextDecoder.prototype;

class TextEncoder {
  constructor() {
    this[webidl.brand] = webidl.brand;
  }

  /** @returns {string} */
  get encoding() {
    webidl.assertBranded(this, TextEncoderPrototype);
    return "utf-8";
  }

  /**
   * @param {string} input
   * @returns {Uint8Array}
   */
  encode(input = "") {
    webidl.assertBranded(this, TextEncoderPrototype);
    const prefix = "Failed to execute 'encode' on 'TextEncoder'";
    // The WebIDL type of `input` is `USVString`, but `core.encode` already
    // converts lone surrogates to the replacement character.
    input = webidl.converters.DOMString(input, {
      prefix,
      context: "Argument 1",
    });
    return core.encode(input);
  }

  /**
   * @param {string} source
   * @param {Uint8Array} destination
   * @returns {TextEncoderEncodeIntoResult}
   */
  encodeInto(source, destination) {
    webidl.assertBranded(this, TextEncoderPrototype);
    const prefix = "Failed to execute 'encodeInto' on 'TextEncoder'";
    // The WebIDL type of `source` is `USVString`, but the ops bindings
    // already convert lone surrogates to the replacement character.
    source = webidl.converters.DOMString(source, {
      prefix,
      context: "Argument 1",
    });
    destination = webidl.converters.Uint8Array(destination, {
      prefix,
      context: "Argument 2",
      allowShared: true,
    });
    ops.op_encoding_encode_into(source, destination, encodeIntoBuf);
    return {
      read: encodeIntoBuf[0],
      written: encodeIntoBuf[1],
    };
  }
}

const encodeIntoBuf = new Uint32Array(2);

webidl.configurePrototype(TextEncoder);
const TextEncoderPrototype = TextEncoder.prototype;

class TextDecoderStream {
  /** @type {TextDecoder} */
  #decoder;
  /** @type {TransformStream<BufferSource, string>} */
  #transform;

  /**
   * @param {string} label
   * @param {TextDecoderOptions} options
   */
  constructor(label = "utf-8", options = {}) {
    const prefix = "Failed to construct 'TextDecoderStream'";
    label = webidl.converters.DOMString(label, {
      prefix,
      context: "Argument 1",
    });
    options = webidl.converters.TextDecoderOptions(options, {
      prefix,
      context: "Argument 2",
    });
    this.#decoder = new TextDecoder(label, options);
    this.#transform = new TransformStream({
      // The transform and flush functions need access to TextDecoderStream's
      // `this`, so they are defined as functions rather than methods.
      transform: (chunk, controller) => {
        try {
          chunk = webidl.converters.BufferSource(chunk, {
            allowShared: true,
          });
          const decoded = this.#decoder.decode(chunk, { stream: true });
          if (decoded) {
            controller.enqueue(decoded);
          }
          return PromiseResolve();
        } catch (err) {
          return PromiseReject(err);
        }
      },
      flush: (controller) => {
        try {
          const final = this.#decoder.decode();
          if (final) {
            controller.enqueue(final);
          }
          return PromiseResolve();
        } catch (err) {
          return PromiseReject(err);
        }
      },
    });
    this[webidl.brand] = webidl.brand;
  }

  /** @returns {string} */
  get encoding() {
    webidl.assertBranded(this, TextDecoderStreamPrototype);
    return this.#decoder.encoding;
  }

  /** @returns {boolean} */
  get fatal() {
    webidl.assertBranded(this, TextDecoderStreamPrototype);
    return this.#decoder.fatal;
  }

  /** @returns {boolean} */
  get ignoreBOM() {
    webidl.assertBranded(this, TextDecoderStreamPrototype);
    return this.#decoder.ignoreBOM;
  }

  /** @returns {ReadableStream<string>} */
  get readable() {
    webidl.assertBranded(this, TextDecoderStreamPrototype);
    return this.#transform.readable;
  }

  /** @returns {WritableStream<BufferSource>} */
  get writable() {
    webidl.assertBranded(this, TextDecoderStreamPrototype);
    return this.#transform.writable;
  }
}

webidl.configurePrototype(TextDecoderStream);
const TextDecoderStreamPrototype = TextDecoderStream.prototype;

class TextEncoderStream {
  /** @type {string | null} */
  #pendingHighSurrogate = null;
  /** @type {TransformStream<string, Uint8Array>} */
  #transform;

  constructor() {
    this.#transform = new TransformStream({
      // The transform and flush functions need access to TextEncoderStream's
      // `this`, so they are defined as functions rather than methods.
      transform: (chunk, controller) => {
        try {
          chunk = webidl.converters.DOMString(chunk);
          if (chunk === "") {
            return PromiseResolve();
          }
          if (this.#pendingHighSurrogate !== null) {
            chunk = this.#pendingHighSurrogate + chunk;
          }
          const lastCodeUnit = StringPrototypeCharCodeAt(
            chunk,
            chunk.length - 1,
          );
          if (0xD800 <= lastCodeUnit && lastCodeUnit <= 0xDBFF) {
            this.#pendingHighSurrogate = StringPrototypeSlice(chunk, -1);
            chunk = StringPrototypeSlice(chunk, 0, -1);
          } else {
            this.#pendingHighSurrogate = null;
          }
          if (chunk) {
            controller.enqueue(core.encode(chunk));
          }
          return PromiseResolve();
        } catch (err) {
          return PromiseReject(err);
        }
      },
      flush: (controller) => {
        try {
          if (this.#pendingHighSurrogate !== null) {
            controller.enqueue(new Uint8Array([0xEF, 0xBF, 0xBD]));
          }
          return PromiseResolve();
        } catch (err) {
          return PromiseReject(err);
        }
      },
    });
    this[webidl.brand] = webidl.brand;
  }

  /** @returns {string} */
  get encoding() {
    webidl.assertBranded(this, TextEncoderStreamPrototype);
    return "utf-8";
  }

  /** @returns {ReadableStream<Uint8Array>} */
  get readable() {
    webidl.assertBranded(this, TextEncoderStreamPrototype);
    return this.#transform.readable;
  }

  /** @returns {WritableStream<string>} */
  get writable() {
    webidl.assertBranded(this, TextEncoderStreamPrototype);
    return this.#transform.writable;
  }
}

webidl.configurePrototype(TextEncoderStream);
const TextEncoderStreamPrototype = TextEncoderStream.prototype;

webidl.converters.TextDecoderOptions = webidl.createDictionaryConverter(
  "TextDecoderOptions",
  [
    {
      key: "fatal",
      converter: webidl.converters.boolean,
      defaultValue: false,
    },
    {
      key: "ignoreBOM",
      converter: webidl.converters.boolean,
      defaultValue: false,
    },
  ],
);
webidl.converters.TextDecodeOptions = webidl.createDictionaryConverter(
  "TextDecodeOptions",
  [
    {
      key: "stream",
      converter: webidl.converters.boolean,
      defaultValue: false,
    },
  ],
);

/**
 * @param {Uint8Array} bytes
 */
function decode(bytes, encoding) {
  const BOMEncoding = BOMSniff(bytes);
  if (BOMEncoding !== null) {
    encoding = BOMEncoding;
    const start = BOMEncoding === "UTF-8" ? 3 : 2;
    bytes = TypedArrayPrototypeSubarray(bytes, start);
  }
  return new TextDecoder(encoding).decode(bytes);
}

/**
 * @param {Uint8Array} bytes
 */
function BOMSniff(bytes) {
  if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return "UTF-8";
  }
  if (bytes[0] === 0xFE && bytes[1] === 0xFF) return "UTF-16BE";
  if (bytes[0] === 0xFF && bytes[1] === 0xFE) return "UTF-16LE";
  return null;
}

export {
  decode,
  TextDecoder,
  TextDecoderStream,
  TextEncoder,
  TextEncoderStream,
};
