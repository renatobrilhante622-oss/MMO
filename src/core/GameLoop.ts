/** Menus are presentation state, never a reason to stop the world clock. */
export interface SimulationState {playing:boolean;characterChosen:boolean;loading:boolean;paused:boolean;}
export function simulationRunning(state:SimulationState):boolean{return state.playing&&state.characterChosen&&!state.loading&&!state.paused;}
