import type { LaundryData, LaundryRepository } from '../domain/laundryRepository';
import type { LaundryOrder } from '../domain/models';
import { parseWeight } from '../domain/rules';

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
}
const message = (error: unknown) => error instanceof Error ? error.message : 'Terjadi masalah pada layanan. Silakan coba lagi.';

export class LaundrySubmissionController {
  private state: SubmissionState = {
    loadStatus: 'loading', data: null, loadError: null, weight: '', notes: '',
    validationError: null, submitStatus: 'idle', submitError: null, submittedOrder: null,
  };
  private listeners = new Set<() => void>();
  private loadAbort?: AbortController;
  private submitAbort?: AbortController;
  private loadVersion = 0;
  constructor(private repository: LaundryRepository) {}
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
      const order = await this.repository.submit({ weight: state.weight, notes: state.notes }, abort.signal);
      if (!abort.signal.aborted) this.patch({ submitStatus: 'success', submittedOrder: order });
    } catch (error) {
      if (!abort.signal.aborted) this.patch({ submitStatus: 'error', submitError: message(error) });
    }
  }
  resetForm() {
    if (this.state.submitStatus === 'submitting') return;
    this.patch({ weight: '', notes: '', validationError: null, submitError: null, submitStatus: 'idle', submittedOrder: null });
  }
  dispose() {
    this.loadAbort?.abort(); this.submitAbort?.abort(); this.loadVersion += 1;
  }
}
