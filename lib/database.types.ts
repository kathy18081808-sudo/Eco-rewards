export interface Profile {
  id: string;
  email: string;
  account_number: string | null;
  alias: string | null;
  full_name: string | null;
  age: number | null;
  date_of_birth: string | null;
  avatar_url: string | null;
  points_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: 'bottle' | 'can' | 'redemption';
  points: number;
  description: string;
  created_at: string;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  image_url: string;
  points_cost: number;
  category: 'coffee' | 'food' | 'drinks' | 'snacks';
  brand: string;
  is_active: boolean;
  created_at: string;
}

export interface RedemptionRecord {
  id: string;
  user_id: string;
  reward_id: string;
  points_spent: number;
  redemption_code: string;
  redeemed_at: string;
  reward?: Reward;
}
