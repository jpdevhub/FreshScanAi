export interface Biomarker {
  score: number;
  status: 'NOMINAL' | 'CAUTION';
  detail: string;
}

export interface ScanResult {
  scan_id: string;
  scan_display_id: string;
  freshness_index: number;
  grade: string;
  confidence: number;
  classification: 'FRESH' | 'SPOILED';
  is_fresh: boolean;
  uncertain_flag: boolean;
  species: {
    common_name: string;
    scientific_name: string;
    habitat: string;
    tags: string[];
    weight_estimate_kg: number;
    catch_age_hours: number;
  };
  biomarkers: {
    gill_saturation: Biomarker;
    corneal_clarity: Biomarker;
    epidermal_tension: Biomarker;
  };
  recommendations: {
    consume_within_hours: number;
    storage_temp: string;
    alert_flags: string[];
  };
  photo_url?: string | null;
  market_name?: string | null;
  timestamp?: string | null;
}

export interface HistoryScan {
  id: string;
  scan_display_id: string;
  species_detected: string;
  freshness_index: number;
  grade: string;
  is_fresh: boolean;
  market_name: string;
  timestamp: string;
  photo_url?: string;
  confidence_score: number;
  image_type: string;
}

export interface HistoryStats {
  total_scans: number;
  avg_freshness_index: number;
  fresh_rate_percent: number;
}

export interface Market {
  id: number;
  name: string;
  score: number;
  lat: number;
  lng: number;
  vendors: number;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
}
