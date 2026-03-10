export interface SceneData {
  sceneNumber: number;
  videoClipUrl: string;
  captionText: string;
  phoneticText: string;
}

export interface KeywordEntry {
  title: string;
  coreKeyword: string;
  location: string;
  scenes: SceneData[];
  backgroundMusic: string;
  status: 'idle' | 'pending' | 'processing' | 'complete' | 'error';
  finalVideoUrl?: string;
  finalAudioUrl?: string;
}

export interface VideoJobConfig {
  resolution: string;
  text_placement: 'top' | 'bottom';
  background_music: string;
}

export interface VideoJobRequest {
  user_id: string;
  password: string;
  method_type: 'Matrix' | 'Heap';
  request_data: {
    configs: VideoJobConfig;
    media_generator: {
      url: string;
      text: string;
      phonetic_text?: string;
    }[];
  };
}

export interface BackgroundTrack {
  url: string;
  name: string; // derived from filename
}

export interface ControlPanelStatus {
  variationGeneratorActive: boolean;
  mediaGeneratorActive: boolean;
}
