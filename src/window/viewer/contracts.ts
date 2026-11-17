export type Viewport = [number, number, number, number];
export type PreparedGeometry = [Float32Array, Uint32Array, string];
export type ViewerError = 'loadError' | 'processError' | 'renderError' | 'contextLost';

export interface Presentation {
  visible: string[];
  focus: string[];
  yaw: number;
  spread: boolean;
  viewport: Viewport;
}

export interface ScrollPresentation {
  from: Presentation;
  to: Presentation;
  progress: number;
}

export interface ViewerOptions {
  viewport: Viewport;
  onBeforeRender: () => void;
  onReady: (ids: string[]) => void;
  onError: (status: ViewerError) => void;
  onSettled: () => void;
}
