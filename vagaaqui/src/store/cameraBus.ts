/** Canal de comandos da interface (fora do Canvas) para a câmera 3D (dentro do Canvas). */
export type CameraCommand =
  | { type: 'zoom'; factor: number }
  | { type: 'rotate'; radians: number }
  | { type: 'tilt'; radians: number }
  | { type: 'north' }
  | { type: 'focus'; x: number; z: number; distance?: number }
  | { type: 'overview' };

type Listener = (c: CameraCommand) => void;
const listeners = new Set<Listener>();

export const cameraBus = {
  emit(c: CameraCommand) {
    for (const l of listeners) l(c);
  },
  on(l: Listener) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
