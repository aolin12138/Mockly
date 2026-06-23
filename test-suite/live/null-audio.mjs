/**
 * NullAudioInterface — no-op implementation for text-only conversations.
 *
 * The ElevenLabs SDK requires an AudioInterface even in text-only mode.
 * This implementation satisfies the interface contract with no side effects.
 * No audio buffers are created, no streams are opened.
 */
import { AudioInterface } from '@elevenlabs/elevenlabs-js/api/resources/conversationalAi/conversation/AudioInterface.js';

export class NullAudioInterface extends AudioInterface {
  /** @type {(audio: Buffer) => void} */
  #inputCallback = null;

  /**
   * Called once before the conversation starts.
   * Stores the callback but never invokes it (text-only = no audio input).
   * @param {(audio: Buffer) => void} inputCallback
   */
  start(inputCallback) {
    this.#inputCallback = inputCallback;
  }

  /**
   * Called once after the conversation ends.
   * Cleans up the stored reference.
   */
  stop() {
    this.#inputCallback = null;
  }

  /**
   * Called when the agent sends audio output.
   * No-op in text-only mode.
   * @param {Buffer} _audio
   */
  output(_audio) {
    // text-only: discard audio output
  }

  /**
   * Called when the user interrupts.
   * No-op — no audio to interrupt.
   */
  interrupt() {
    // text-only: nothing to interrupt
  }
}
