import type { LaundryData, LaundryRepository } from '../domain/laundryRepository';
import type { LaundryOrder } from '../domain/models';
import { parseWeight } from '../domain/rules';
import type { PhotoPicker, PhotoResult } from '../../../shared/services/photoPicker';

export interface SubmissionState {
  loadStatus: 'loading' | 'loaded' | 'error';
  data: LaundryData | null;
  loadError: string | null;
  weight: string;
  notes: string;
  validationError: string | null;
  submitStatus: 'idle' | 'submitting' | 'success' | 'error';
  submitError: string | null;
  submittedOrder: LaundryOrder | null;
  photo: string | null;
  photoBusy: boolean;
  photoMessage: { kind: 'info' | 'error'; text: string } | null;
}

// What the user sees for each way the camera / gallery can end (permission, cancel, failure).
export function photoMessageFor(result: Exclude<PhotoResult, { status: 'ok' }>, source: 'camera' | 'library'): { kind: 'info' | 'error'; text: string } {
  switch (result.status) {
    case 'cancelled': return { kind: 'info', text: source === 'camera' ? 'Pengambilan foto dibatalkan. Foto tidak berubah.' : 'Pemilihan foto dibatalkan. Foto tidak berubah.' };
    case 'denied': return { kind: 'error', text: result.canAskAgain
      ? 'Izin kamera ditolak, jadi foto belum bisa diambil. Ketuk "Ambil foto" lagi untuk mengizinkan, atau pilih foto dari galeri.'
      : 'Izin kamera diblokir. Aktifkan izin kamera di pengaturan perangkat atau browser, atau pilih foto dari galeri. Pengajuan tetap bisa dikirim tanpa foto.' };
    case 'too-large': return { kind: 'error', text: 'Foto terlalu besar. Ambil ulang dari jarak yang lebih dekat atau pilih foto yang lebih kecil.' };
    case 'error': return { kind: 'error', text: result.message };
  }
}
const message = (error: unknown) => error instanceof Error ? error.message : 'Terjadi masalah pada layanan. Silakan coba lagi.';

export class LaundrySubmissionController {
  private state: SubmissionState = {
    loadStatus: 'loading', data: null, loadError: null, weight: '', notes: '',
    validationError: null, submitStatus: 'idle', submitError: null, submittedOrder: null,
    photo: null, photoBusy: false, photoMessage: null,
  };
  private listeners = new Set<() => void>();
  private loadAbort?: AbortController;
  private submitAbort?: AbortController;
  private loadVersion = 0;
  constructor(private repository: LaundryRepository, private photoPicker: PhotoPicker | null = null) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  private patch(update: Partial<SubmissionState>) {
    this.state = { ...this.state, ...update };
    this.listeners.forEach((listener) => listener());
  }
  connect() {
    const unsubscribe = this.repository.subscribe((data) => {
      if (this.state.loadStatus === 'loaded') this.patch({ data });
    });
    void this.load();
    return () => { unsubscribe(); this.dispose(); };
  }
  async load() {
    if (this.state.submitStatus === 'submitting') return;
    this.loadAbort?.abort();
    const abort = this.loadAbort = new AbortController();
    const version = ++this.loadVersion;
    this.patch({ loadStatus: 'loading', loadError: null });
    try {
      const data = await this.repository.load(abort.signal);
      if (!abort.signal.aborted && version === this.loadVersion) this.patch({ loadStatus: 'loaded', data });
    } catch (error) {
      if (!abort.signal.aborted && version === this.loadVersion) this.patch({ loadStatus: 'error', data: null, loadError: message(error) });
    }
  }
  setWeight(weight: string) {
    if (this.state.submitStatus === 'submitting' || this.state.submitStatus === 'success') return;
    this.patch({ weight, validationError: null, submitError: null, submitStatus: 'idle' });
  }
  setNotes(notes: string) {
    if (this.state.submitStatus === 'submitting' || this.state.submitStatus === 'success') return;
    this.patch({ notes });
  }
  async attachPhoto(source: 'camera' | 'library') {
    const state = this.state;
    if (state.photoBusy || state.submitStatus === 'submitting' || state.submitStatus === 'success') return;
    if (!this.photoPicker) { this.patch({ photoMessage: { kind: 'error', text: 'Kamera tidak tersedia di perangkat ini.' } }); return; }
    this.patch({ photoBusy: true, photoMessage: null });
    const result = await (source === 'camera' ? this.photoPicker.takePhoto() : this.photoPicker.pickFromLibrary());
    if (result.status === 'ok') this.patch({ photoBusy: false, photo: result.uri, photoMessage: null });
    else this.patch({ photoBusy: false, photoMessage: photoMessageFor(result, source) });
  }
  removePhoto() {
    if (this.state.submitStatus === 'submitting' || this.state.submitStatus === 'success') return;
    this.patch({ photo: null, photoMessage: null });
  }
  async submit(): Promise<void> {
    const state = this.state;
    // Guard is synchronous, before await: even two taps in one frame call the
    // repository only once. The disabled button is a second protection in UI.
    if (state.submitStatus === 'submitting' || state.submitStatus === 'success' || state.loadStatus !== 'loaded' || !state.data) return;
    try {
      const weight = parseWeight(state.weight);
      if (Math.round(weight * 100) > Math.round(state.data.quota.remainingKg * 100)) throw new Error(`Berat melebihi sisa kuota ${state.data.quota.remainingKg.toLocaleString('id-ID')} kg.`);
    } catch (error) {
      this.patch({ validationError: message(error), submitStatus: 'idle', submitError: null });
      return;
    }
    const abort = this.submitAbort = new AbortController();
    this.patch({ submitStatus: 'submitting', validationError: null, submitError: null });
    try {
      const order = await this.repository.submit({ weight: state.weight, notes: state.notes, ...(state.photo ? { photoUri: state.photo } : {}) }, abort.signal);
      if (!abort.signal.aborted) this.patch({ submitStatus: 'success', submittedOrder: order });
    } catch (error) {
      if (!abort.signal.aborted) this.patch({ submitStatus: 'error', submitError: message(error) });
    }
  }
  resetForm() {
    if (this.state.submitStatus === 'submitting') return;
    this.patch({ weight: '', notes: '', validationError: null, submitError: null, submitStatus: 'idle', submittedOrder: null, photo: null, photoMessage: null });
  }
  dispose() {
    this.loadAbort?.abort(); this.submitAbort?.abort(); this.loadVersion += 1;
  }
}
