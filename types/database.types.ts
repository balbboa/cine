export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      achievements: {
        Row: {
          achievement_type: string
          created_at: string
          credits_reward: number
          description: string
          icon: string
          id: number
          is_hidden: boolean
          name: string
          required_value: number
          xp_reward: number
        }
        Insert: {
          achievement_type: string
          created_at?: string
          credits_reward?: number
          description: string
          icon: string
          id?: never
          is_hidden?: boolean
          name: string
          required_value?: number
          xp_reward?: number
        }
        Update: {
          achievement_type?: string
          created_at?: string
          credits_reward?: number
          description?: string
          icon?: string
          id?: never
          is_hidden?: boolean
          name?: string
          required_value?: number
          xp_reward?: number
        }
        Relationships: []
      }
      badges: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          description: string
          icon: string
          id?: never
          name: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: never
          name?: string
        }
        Relationships: []
      }
      club_join_requests: {
        Row: {
          club_id: number
          created_at: string
          id: number
          message: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: number
          created_at?: string
          id?: never
          message?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: number
          created_at?: string
          id?: never
          message?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_join_requests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          club_id: number
          id: number
          is_owner: boolean
          joined_at: string
          user_id: string
        }
        Insert: {
          club_id: number
          id?: never
          is_owner?: boolean
          joined_at?: string
          user_id: string
        }
        Update: {
          club_id?: number
          id?: never
          is_owner?: boolean
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clubs: {
        Row: {
          avatar_url: string | null
          created_at: string
          description: string
          id: number
          member_count: number
          name: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          description: string
          id?: never
          member_count?: number
          name: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          description?: string
          id?: never
          member_count?: number
          name?: string
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          id: number
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: never
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: never
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: never
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: never
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      game_invites: {
        Row: {
          created_at: string
          game_id: string | null
          id: number
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_id?: string | null
          id?: never
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_id?: string | null
          id?: never
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_invites_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_invites_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_invites_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_invites_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_invites_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      game_moves: {
        Row: {
          col: number
          created_at: string
          game_id: string
          guest_user_id: string | null
          id: number
          movie: string
          row: number
          time_to_answer: number
          user_id: string
        }
        Insert: {
          col: number
          created_at?: string
          game_id: string
          guest_user_id?: string | null
          id?: never
          movie: string
          row: number
          time_to_answer?: number
          user_id: string
        }
        Update: {
          col?: number
          created_at?: string
          game_id?: string
          guest_user_id?: string | null
          id?: never
          movie?: string
          row?: number
          time_to_answer?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_moves_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_moves_guest_user_id_fkey"
            columns: ["guest_user_id"]
            isOneToOne: false
            referencedRelation: "guest_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_moves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_moves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          board_state: Json | null
          completed_at: string | null
          created_at: string
          game_mode: string
          id: string
          invite_code: string | null
          normalized_invite_code: string | null
          player1_display_name: string | null
          player1_guest_id: string | null
          player1_id: string | null
          player2_display_name: string | null
          player2_guest_id: string | null
          player2_id: string | null
          status: string
          winner_id: string | null
        }
        Insert: {
          board_state?: Json | null
          completed_at?: string | null
          created_at?: string
          game_mode?: string
          id?: string
          invite_code?: string | null
          normalized_invite_code?: string | null
          player1_display_name?: string | null
          player1_guest_id?: string | null
          player1_id?: string | null
          player2_display_name?: string | null
          player2_guest_id?: string | null
          player2_id?: string | null
          status?: string
          winner_id?: string | null
        }
        Update: {
          board_state?: Json | null
          completed_at?: string | null
          created_at?: string
          game_mode?: string
          id?: string
          invite_code?: string | null
          normalized_invite_code?: string | null
          player1_display_name?: string | null
          player1_guest_id?: string | null
          player1_id?: string | null
          player2_display_name?: string | null
          player2_guest_id?: string | null
          player2_id?: string | null
          status?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_player1_guest_id_fkey"
            columns: ["player1_guest_id"]
            isOneToOne: false
            referencedRelation: "guest_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_player2_guest_id_fkey"
            columns: ["player2_guest_id"]
            isOneToOne: false
            referencedRelation: "guest_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_users: {
        Row: {
          created_at: string
          id: string
          last_active: string
          losses: number
          username: string
          wins: number
          xp: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_active?: string
          losses?: number
          username: string
          wins?: number
          xp?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_active?: string
          losses?: number
          username?: string
          wins?: number
          xp?: number
        }
        Relationships: []
      }
      migrations: {
        Row: {
          applied_at: string
          id: number
          name: string
        }
        Insert: {
          applied_at?: string
          id?: number
          name: string
        }
        Update: {
          applied_at?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      seasonal_leaderboards: {
        Row: {
          created_at: string
          end_date: string
          id: number
          is_active: boolean | null
          season_name: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: never
          is_active?: boolean | null
          season_name: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: never
          is_active?: boolean | null
          season_name?: string
          start_date?: string
        }
        Relationships: []
      }
      seasonal_player_stats: {
        Row: {
          created_at: string
          highest_rank: number | null
          id: number
          losses: number
          season_id: number
          updated_at: string
          user_id: string
          wins: number
        }
        Insert: {
          created_at?: string
          highest_rank?: number | null
          id?: never
          losses?: number
          season_id: number
          updated_at?: string
          user_id: string
          wins?: number
        }
        Update: {
          created_at?: string
          highest_rank?: number | null
          id?: never
          losses?: number
          season_id?: number
          updated_at?: string
          user_id?: string
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "seasonal_player_stats_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasonal_leaderboards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seasonal_player_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seasonal_player_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      store_items: {
        Row: {
          created_at: string
          description: string
          id: number
          image_url: string | null
          name: string
          price: number
          type: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: never
          image_url?: string | null
          name: string
          price: number
          type: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: never
          image_url?: string | null
          name?: string
          price?: number
          type?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: number
          completed_at: string | null
          created_at: string
          id: number
          is_completed: boolean
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          achievement_id: number
          completed_at?: string | null
          created_at?: string
          id?: never
          is_completed?: boolean
          progress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: number
          completed_at?: string | null
          created_at?: string
          id?: never
          is_completed?: boolean
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: number
          earned_at: string
          id: number
          user_id: string
        }
        Insert: {
          badge_id: number
          earned_at?: string
          id?: never
          user_id: string
        }
        Update: {
          badge_id?: number
          earned_at?: string
          id?: never
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_inventory: {
        Row: {
          equipped: boolean
          id: number
          item_id: number
          purchased_at: string
          user_id: string
        }
        Insert: {
          equipped?: boolean
          id?: never
          item_id: number
          purchased_at?: string
          user_id: string
        }
        Update: {
          equipped?: boolean
          id?: never
          item_id?: number
          purchased_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "store_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_inventory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "global_leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_inventory_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          credits: number
          email: string
          id: string
          level: number
          losses: number
          online_status: string | null
          username: string
          wins: number
          xp: number
          xp_to_next_level: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          credits?: number
          email: string
          id: string
          level?: number
          losses?: number
          online_status?: string | null
          username: string
          wins?: number
          xp?: number
          xp_to_next_level?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          credits?: number
          email?: string
          id?: string
          level?: number
          losses?: number
          online_status?: string | null
          username?: string
          wins?: number
          xp?: number
          xp_to_next_level?: number
        }
        Relationships: []
      }
    }
    Views: {
      global_leaderboard: {
        Row: {
          avatar_url: string | null
          id: string | null
          level: number | null
          losses: number | null
          rank: number | null
          username: string | null
          win_rate: number | null
          wins: number | null
          xp: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_club: {
        Args: {
          p_name: string
          p_description?: string
        }
        Returns: string
      }
      create_club_join_request: {
        Args: {
          p_club_id: number
          p_user_id: string
          p_message?: string
        }
        Returns: Json
      }
      create_club_with_membership: {
        Args: {
          name: string
          description?: string
        }
        Returns: string
      }
      create_game_with_guest: {
        Args: {
          p_guest_id: string
          p_username: string
          p_game_mode?: string
        }
        Returns: {
          game_id: string
          invite_code: string
          guest_id: string
        }[]
      }
      create_guest_user: {
        Args: {
          username: string
        }
        Returns: string
      }
      create_guild_with_membership: {
        Args: {
          club_name: string
          club_description: string
          creator_id: string
        }
        Returns: Json
      }
      create_migrations_table_if_not_exists: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      create_new_season: {
        Args: {
          p_season_name: string
          p_start_date: string
          p_end_date: string
          p_is_active?: boolean
        }
        Returns: number
      }
      find_user_by_username: {
        Args: {
          username_param: string
        }
        Returns: {
          id: string
          username: string
          avatar_url: string
        }[]
      }
      generate_invite_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_all_clubs: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string | null
          created_at: string
          description: string
          id: number
          member_count: number
          name: string
        }[]
      }
      get_club_join_requests: {
        Args: {
          p_club_id: number
        }
        Returns: {
          id: number
          club_id: number
          user_id: string
          status: string
          message: string
          created_at: string
          updated_at: string
          username: string
          avatar_url: string
        }[]
      }
      get_club_rankings: {
        Args: {
          limit_count: number
        }
        Returns: {
          id: number
          name: string
          avatar_url: string
          member_count: number
        }[]
      }
      get_clubs_with_member_count: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          name: string
          description: string
          created_at: string
          created_by: string
          updated_at: string
          member_count: number
          is_member: boolean
        }[]
      }
      get_game_by_invite_code: {
        Args: {
          p_invite_code: string
        }
        Returns: Json
      }
      get_player_rank: {
        Args: {
          player_id: string
        }
        Returns: {
          global_rank: number
          seasonal_rank: number
          season_name: string
        }[]
      }
      get_top_players: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_season_id?: number
        }
        Returns: {
          player_id: string
          username: string
          avatar_url: string
          wins: number
          losses: number
          win_rate: number
          rank: number
        }[]
      }
      get_user_achievements: {
        Args: {
          p_user_id: string
        }
        Returns: {
          achievement_id: number
          name: string
          description: string
          icon: string
          progress: number
          required_value: number
          is_completed: boolean
          completed_at: string
          is_hidden: boolean
          xp_reward: number
          credits_reward: number
        }[]
      }
      is_club_member: {
        Args: {
          club_id: string
        }
        Returns: boolean
      }
      join_game_as_guest: {
        Args: {
          p_invite_code: string
          p_guest_id: string
          p_username: string
        }
        Returns: {
          game_id: string
          guest_id: string
        }[]
      }
      join_game_with_code: {
        Args: {
          p_invite_code: string
          p_user_id: string
        }
        Returns: Json
      }
      refresh_leaderboard: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      respond_to_club_join_request: {
        Args: {
          p_request_id: number
          p_accept: boolean
        }
        Returns: Json
      }
      respond_to_friend_request: {
        Args: {
          request_id_param: number
          user_id_param: string
          accept: boolean
        }
        Returns: Json
      }
      respond_to_game_invite: {
        Args: {
          invite_id_param: number
          user_id_param: string
          accept: boolean
        }
        Returns: Json
      }
      send_friend_request: {
        Args: {
          sender_id_param: string
          receiver_username: string
        }
        Returns: Json
      }
      send_game_invite: {
        Args: {
          sender_id_param: string
          receiver_id_param: string
          game_id_param: string
        }
        Returns: Json
      }
      update_achievement_progress: {
        Args: {
          p_user_id: string
          p_achievement_type: string
          p_progress_value?: number
        }
        Returns: {
          achievement_id: number
          achievement_name: string
          is_newly_completed: boolean
          xp_gained: number
          credits_gained: number
        }[]
      }
      update_user_xp: {
        Args: {
          user_id_param: string
          xp_to_add: number
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
