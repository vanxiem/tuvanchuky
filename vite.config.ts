
export type MachineBrand = 'CLF' | 'JSW' | 'JAD' | 'Kai Mei' | 'SMC' | 'Akei' | 'Fki';

export interface MoldingRecord {
  id: string;
  brand: MachineBrand;
  model: string;
  tonnage: number;
  product: string;
  weight: number;
  cavities: number;
  cycleTime: number;
  injectionTime: number;
  holdingTime: number;
  coolingTime: number;
  chargingTime: number;
  moldCloseTime: number;
  moldOpenTime: number;
  ejectionTime: number;
  meltTemp: number;
  moldTemp: number;
  injectionPressure: number;
  injectionSpeed: number;
  moldCloseSpeed: number;
  moldOpenSpeed: number;
  ejectionSpeed: number;
  chargingSpeed: number;
  backPressure: number;
  screwSpeed: number;
  cushion: number;
  clampingForce: number;
  defectRate: number;
  notes: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface DetailCycleData {
  cycleTime: number;
  injectionTime: number;
  holdingTime: number;
  coolingTime: number;
  chargingTime: number;
  moldCloseTime: number;
  moldOpenTime: number;
  ejectionTime: number;
  coreInTime: number;
  coreOutTime: number;
  robotTime: number;
  waitRobotTime: number;
}

export interface CLFStage {
  pressure: number | string;
  speed: number | string;
  position: number | string;
  time?: number | string;
}

export interface CLFParameters {
  moldClose: {
    stage1: CLFStage;
    stage2: CLFStage;
    lp: CLFStage;
    hp: CLFStage;
    closeTime: number | string;
  };
  moldOpen: {
    open: CLFStage;
    openFull: CLFStage;
    stage3: CLFStage;
    stage2: CLFStage;
    stage1: CLFStage;
    openTime: number | string;
  };
  injection: {
    stages: CLFStage[]; // 1-7
    coolingTime: number | string;
    injectionTime: number | string;
    holdingWaitTime: number | string;
  };
  holding: {
    stage3: CLFStage;
    stage2: CLFStage;
    stage1: CLFStage;
  };
  charging: {
    stage1: CLFStage;
    stage2: CLFStage;
    stage3: CLFStage;
    backPressure: number | string;
    chargingTime: number | string;
  };
  suckback: {
    before: CLFStage;
    after: CLFStage;
  };
  ejection: {
    back: CLFStage;
    forward: CLFStage;
    ejectionTime: number | string;
  };
  other?: {
    robotTime: number | string;
    waitRobotTime: number | string;
  };
  core: {
    in1: CLFStage;
    out1: CLFStage;
    in2: CLFStage;
    out2: CLFStage;
    in3: CLFStage;
    out3: CLFStage;
  };
  temperatures: {
    barrel: (number | string)[];
    hotRunner: (number | string)[];
  };
}

export interface ImprovementData {
  before: DetailCycleData;
  after: DetailCycleData;
  clfBefore?: CLFParameters;
  clfAfter?: CLFParameters;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'user' | 'admin';
  department?: string;
  createdAt: any;
}

export interface AnalysisHistoryRecord {
  id?: string;
  createdAt: any;
  userName: string;
  userEmail: string;
  department: string;
  productName: string;
  machineCode: string;
  
  inputCycle: number;
  suggestedCycle: number;
  reducedSeconds: number;
  reducedPercent: number;
  riskLevel?: string;
  
  status: 'completed' | 'error' | 'processing';
  processingTimeSec?: number;
  aiResultSummary: string;
  aiRecommendations: string[];
  fullAnalysis?: string;
  fullImprovementData?: ImprovementData;
  
  inputParams?: {
    pressure: string;
    temperature: string;
    coolingTime: string;
    speed: string;
    material: string;
    [key: string]: string;
  };
  
  rawInputData?: string;
  machineImageUrl?: string;
  technicalNote?: string;
  inputMethod?: string;
  languageSelected?: string;
  
  confirmed: boolean;
  confirmedAt?: any;
  source: 'user_app';
  userId: string;
}
