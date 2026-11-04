
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admin_actions": {
                  Row: {
                    "action": string,"action_id": number,"admin_id": string,"created_at": string,"reason": string,"target_id": string,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"action_id"?: never,"admin_id": string,"created_at"?: string,"reason": string,"target_id": string,"target_type": string
                  }
                  Update: {
                    "action"?: string,"action_id"?: never,"admin_id"?: string,"created_at"?: string,"reason"?: string,"target_id"?: string,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_actions_admin_id_fkey"
      columns: ["admin_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"body_log_sources": {
                  Row: {
                    "created_at": string,"external_ref": string | null,"ocr_confidence": number | null,"parser_version": string | null,"source_id": string,"source_type": string,"template_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"external_ref"?: string | null,"ocr_confidence"?: number | null,"parser_version"?: string | null,"source_id"?: string,"source_type": string,"template_id"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"external_ref"?: string | null,"ocr_confidence"?: number | null,"parser_version"?: string | null,"source_id"?: string,"source_type"?: string,"template_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "body_log_sources_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"body_logs": {
                  Row: {
                    "body_fat_kg": number | null,"body_fat_pct": number | null,"created_at": string,"is_baseline": boolean,"is_verified": boolean,"log_id": string,"measured_at": string,"skeletal_muscle_kg": number | null,"source": string,"source_id": string | null,"user_id": string,"weight_kg": number
                  }
                  ComputedFields: never
                  Insert: {
                    "body_fat_kg"?: number | null,"body_fat_pct"?: number | null,"created_at"?: string,"is_baseline"?: boolean,"is_verified"?: boolean,"log_id"?: string,"measured_at": string,"skeletal_muscle_kg"?: number | null,"source"?: string,"source_id"?: string | null,"user_id"?: string,"weight_kg": number
                  }
                  Update: {
                    "body_fat_kg"?: number | null,"body_fat_pct"?: number | null,"created_at"?: string,"is_baseline"?: boolean,"is_verified"?: boolean,"log_id"?: string,"measured_at"?: string,"skeletal_muscle_kg"?: number | null,"source"?: string,"source_id"?: string | null,"user_id"?: string,"weight_kg"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "body_logs_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "body_log_sources"
      referencedColumns: ["source_id"]
    },{
      foreignKeyName: "body_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"comments": {
                  Row: {
                    "body": string,"comment_id": string,"created_at": string,"deleted_at": string | null,"post_id": string,"risk_level": string,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"comment_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"post_id": string,"risk_level": string,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"comment_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"post_id"?: string,"risk_level"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["post_id"]
    },{
      foreignKeyName: "comments_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"consents": {
                  Row: {
                    "agreed_at": string,"consent_id": number,"type": string,"user_id": string,"version": string,"withdrawn_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "agreed_at"?: string,"consent_id"?: never,"type": string,"user_id": string,"version": string,"withdrawn_at"?: string | null
                  }
                  Update: {
                    "agreed_at"?: string,"consent_id"?: never,"type"?: string,"user_id"?: string,"version"?: string,"withdrawn_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "consents_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"daily_checks": {
                  Row: {
                    "appetite": number | null,"check_id": number,"condition": number | null,"date": string,"sleep_h": number | null,"supplement_done": boolean | null,"user_id": string,"water_cups": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "appetite"?: number | null,"check_id"?: never,"condition"?: number | null,"date": string,"sleep_h"?: number | null,"supplement_done"?: boolean | null,"user_id"?: string,"water_cups"?: number | null
                  }
                  Update: {
                    "appetite"?: number | null,"check_id"?: never,"condition"?: number | null,"date"?: string,"sleep_h"?: number | null,"supplement_done"?: boolean | null,"user_id"?: string,"water_cups"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_checks_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"doses": {
                  Row: {
                    "created_at": string,"date_approx": boolean,"dose_id": string,"dose_mg": number,"injected_at": string,"med_id": string,"memo": string | null,"site": string | null,"time_unknown": boolean,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date_approx"?: boolean,"dose_id"?: string,"dose_mg": number,"injected_at": string,"med_id": string,"memo"?: string | null,"site"?: string | null,"time_unknown"?: boolean,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"date_approx"?: boolean,"dose_id"?: string,"dose_mg"?: number,"injected_at"?: string,"med_id"?: string,"memo"?: string | null,"site"?: string | null,"time_unknown"?: boolean,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "doses_med_id_fkey"
      columns: ["med_id"]
isOneToOne: false
      referencedRelation: "medications"
      referencedColumns: ["med_id"]
    },{
      foreignKeyName: "doses_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"filter_logs": {
                  Row: {
                    "checked_at": string,"filter_id": number,"level": string,"matched_rule": string | null,"target_id": string | null,"target_type": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "checked_at"?: string,"filter_id"?: never,"level": string,"matched_rule"?: string | null,"target_id"?: string | null,"target_type": string,"user_id"?: string | null
                  }
                  Update: {
                    "checked_at"?: string,"filter_id"?: never,"level"?: string,"matched_rule"?: string | null,"target_id"?: string | null,"target_type"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "filter_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"foods": {
                  Row: {
                    "ai_class": boolean,"basis_grams": number,"basis_label": string,"brand": string | null,"carb_g": number | null,"category": string,"created_at": string,"data_source": string | null,"fat_g": number | null,"food_id": string,"kcal": number,"name": string,"owner_id": string | null,"protein_g": number | null,"serving_g": number,"sodium_mg": number | null,"units": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_class"?: boolean,"basis_grams": number,"basis_label": string,"brand"?: string | null,"carb_g"?: number | null,"category": string,"created_at"?: string,"data_source"?: string | null,"fat_g"?: number | null,"food_id"?: string,"kcal": number,"name": string,"owner_id"?: string | null,"protein_g"?: number | null,"serving_g": number,"sodium_mg"?: number | null,"units"?: Json | null
                  }
                  Update: {
                    "ai_class"?: boolean,"basis_grams"?: number,"basis_label"?: string,"brand"?: string | null,"carb_g"?: number | null,"category"?: string,"created_at"?: string,"data_source"?: string | null,"fat_g"?: number | null,"food_id"?: string,"kcal"?: number,"name"?: string,"owner_id"?: string | null,"protein_g"?: number | null,"serving_g"?: number,"sodium_mg"?: number | null,"units"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "foods_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"intake_items": {
                  Row: {
                    "active": boolean,"created_at": string,"item_id": string,"kind": string,"last_reminded_on": string | null,"name": string,"remind_asked": boolean,"remind_enabled": boolean,"remind_hour": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"item_id"?: string,"kind": string,"last_reminded_on"?: string | null,"name": string,"remind_asked"?: boolean,"remind_enabled"?: boolean,"remind_hour"?: number | null,"user_id"?: string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"item_id"?: string,"kind"?: string,"last_reminded_on"?: string | null,"name"?: string,"remind_asked"?: boolean,"remind_enabled"?: boolean,"remind_hour"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "intake_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"intake_logs": {
                  Row: {
                    "amount_ml": number | null,"item_id": string | null,"kind": string,"log_id": string,"scheduled_at": string | null,"status": string,"taken_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_ml"?: number | null,"item_id"?: string | null,"kind": string,"log_id"?: string,"scheduled_at"?: string | null,"status"?: string,"taken_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "amount_ml"?: number | null,"item_id"?: string | null,"kind"?: string,"log_id"?: string,"scheduled_at"?: string | null,"status"?: string,"taken_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "intake_logs_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "intake_items"
      referencedColumns: ["item_id"]
    },{
      foreignKeyName: "intake_logs_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"meal_items": {
                  Row: {
                    "brand": string | null,"carb_g": number | null,"fat_g": number | null,"food_id": string | null,"from_photo": boolean,"grams": number,"item_id": string,"kcal": number,"meal_id": string,"name": string,"protein_g": number | null,"sort_order": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brand"?: string | null,"carb_g"?: number | null,"fat_g"?: number | null,"food_id"?: string | null,"from_photo"?: boolean,"grams": number,"item_id"?: string,"kcal": number,"meal_id": string,"name": string,"protein_g"?: number | null,"sort_order"?: number,"user_id"?: string
                  }
                  Update: {
                    "brand"?: string | null,"carb_g"?: number | null,"fat_g"?: number | null,"food_id"?: string | null,"from_photo"?: boolean,"grams"?: number,"item_id"?: string,"kcal"?: number,"meal_id"?: string,"name"?: string,"protein_g"?: number | null,"sort_order"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_items_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["food_id"]
    },{
      foreignKeyName: "meal_items_meal_id_fkey"
      columns: ["meal_id"]
isOneToOne: false
      referencedRelation: "meals"
      referencedColumns: ["meal_id"]
    },{
      foreignKeyName: "meal_items_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"meals": {
                  Row: {
                    "created_at": string,"eaten_at": string,"meal_id": string,"meal_type": string,"photo_bytes": number | null,"photo_exif_stripped": boolean | null,"photo_height": number | null,"photo_mime": string | null,"photo_path": string | null,"photo_width": number | null,"source": string,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"eaten_at": string,"meal_id"?: string,"meal_type": string,"photo_bytes"?: number | null,"photo_exif_stripped"?: boolean | null,"photo_height"?: number | null,"photo_mime"?: string | null,"photo_path"?: string | null,"photo_width"?: number | null,"source": string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"eaten_at"?: string,"meal_id"?: string,"meal_type"?: string,"photo_bytes"?: number | null,"photo_exif_stripped"?: boolean | null,"photo_height"?: number | null,"photo_mime"?: string | null,"photo_path"?: string | null,"photo_width"?: number | null,"source"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meals_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"medications": {
                  Row: {
                    "dose_options": (number)[] | null,"half_life_h": number | null,"ingredient": string,"med_id": string,"name": string,"pk_params": NonNullable<Json>,"sites": (string)[] | null,"source": string | null,"updated_at": string,"verified": string
                  }
                  ComputedFields: never
                  Insert: {
                    "dose_options"?: (number)[] | null,"half_life_h"?: number | null,"ingredient": string,"med_id": string,"name": string,"pk_params"?: NonNullable<Json>,"sites"?: (string)[] | null,"source"?: string | null,"updated_at"?: string,"verified"?: string
                  }
                  Update: {
                    "dose_options"?: (number)[] | null,"half_life_h"?: number | null,"ingredient"?: string,"med_id"?: string,"name"?: string,"pk_params"?: NonNullable<Json>,"sites"?: (string)[] | null,"source"?: string | null,"updated_at"?: string,"verified"?: string
                  }
                  Relationships: [
                    
                  ]
                },"model_versions": {
                  Row: {
                    "created_at": string,"latency_ms": number | null,"macro_f1": number | null,"method": string,"model_ver_id": string,"precision_m": number | null,"recall_m": number | null,"task": string,"thresholds": Json | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"latency_ms"?: number | null,"macro_f1"?: number | null,"method": string,"model_ver_id": string,"precision_m"?: number | null,"recall_m"?: number | null,"task"?: string,"thresholds"?: Json | null
                  }
                  Update: {
                    "created_at"?: string,"latency_ms"?: number | null,"macro_f1"?: number | null,"method"?: string,"model_ver_id"?: string,"precision_m"?: number | null,"recall_m"?: number | null,"task"?: string,"thresholds"?: Json | null
                  }
                  Relationships: [
                    
                  ]
                },"post_likes": {
                  Row: {
                    "created_at": string,"post_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"post_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"post_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "post_likes_post_id_fkey"
      columns: ["post_id"]
isOneToOne: false
      referencedRelation: "posts"
      referencedColumns: ["post_id"]
    },{
      foreignKeyName: "post_likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"posts": {
                  Row: {
                    "body": string,"category": string,"comment_count": number,"created_at": string,"deleted_at": string | null,"like_count": number,"post_id": string,"risk_level": string,"status": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"category"?: string,"comment_count"?: number,"created_at"?: string,"deleted_at"?: string | null,"like_count"?: number,"post_id"?: string,"risk_level": string,"status"?: string,"title": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"category"?: string,"comment_count"?: number,"created_at"?: string,"deleted_at"?: string | null,"like_count"?: number,"post_id"?: string,"risk_level"?: string,"status"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "posts_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"predictions": {
                  Row: {
                    "candidates": (string)[],"corrected_food_id": string | null,"created_at": string,"feedback_at": string | null,"meal_id": string,"meal_item_id": string | null,"mode": string,"model_ver_id": string,"pred_id": string,"predicted_food_id": string,"score": number | null,"status": string,"threshold": number | null,"user_action": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "candidates"?: (string)[],"corrected_food_id"?: string | null,"created_at"?: string,"feedback_at"?: string | null,"meal_id": string,"meal_item_id"?: string | null,"mode": string,"model_ver_id": string,"pred_id"?: string,"predicted_food_id": string,"score"?: number | null,"status": string,"threshold"?: number | null,"user_action"?: string | null,"user_id": string
                  }
                  Update: {
                    "candidates"?: (string)[],"corrected_food_id"?: string | null,"created_at"?: string,"feedback_at"?: string | null,"meal_id"?: string,"meal_item_id"?: string | null,"mode"?: string,"model_ver_id"?: string,"pred_id"?: string,"predicted_food_id"?: string,"score"?: number | null,"status"?: string,"threshold"?: number | null,"user_action"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "predictions_meal_id_fkey"
      columns: ["meal_id"]
isOneToOne: false
      referencedRelation: "meals"
      referencedColumns: ["meal_id"]
    },{
      foreignKeyName: "predictions_meal_item_id_fkey"
      columns: ["meal_item_id"]
isOneToOne: false
      referencedRelation: "meal_items"
      referencedColumns: ["item_id"]
    },{
      foreignKeyName: "predictions_model_ver_id_fkey"
      columns: ["model_ver_id"]
isOneToOne: false
      referencedRelation: "model_versions"
      referencedColumns: ["model_ver_id"]
    },{
      foreignKeyName: "predictions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"p256dh": string,"sub_id": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"p256dh": string,"sub_id"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"p256dh"?: string,"sub_id"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"detail": string | null,"reason": string,"report_id": string,"reporter_id": string,"status": string,"target_id": string,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"detail"?: string | null,"reason": string,"report_id"?: string,"reporter_id"?: string,"status"?: string,"target_id": string,"target_type": string
                  }
                  Update: {
                    "created_at"?: string,"detail"?: string | null,"reason"?: string,"report_id"?: string,"reporter_id"?: string,"status"?: string,"target_id"?: string,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"symptoms": {
                  Row: {
                    "created_at": string,"duration_h": number | null,"memo": string | null,"severity": number,"started_at": string,"symptom_id": string,"type": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"duration_h"?: number | null,"memo"?: string | null,"severity": number,"started_at": string,"symptom_id"?: string,"type": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"duration_h"?: number | null,"memo"?: string | null,"severity"?: number,"started_at"?: string,"symptom_id"?: string,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "symptoms_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"user_health": {
                  Row: {
                    "birth_year": number | null,"current_med_id": string | null,"goal_weight_kg": number | null,"height_cm": number | null,"legal_name": string | null,"protein_goal_g": number | null,"start_weight_kg": number | null,"updated_at": string,"user_id": string,"water_goal_ml": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_year"?: number | null,"current_med_id"?: string | null,"goal_weight_kg"?: number | null,"height_cm"?: number | null,"legal_name"?: string | null,"protein_goal_g"?: number | null,"start_weight_kg"?: number | null,"updated_at"?: string,"user_id": string,"water_goal_ml"?: number | null
                  }
                  Update: {
                    "birth_year"?: number | null,"current_med_id"?: string | null,"goal_weight_kg"?: number | null,"height_cm"?: number | null,"legal_name"?: string | null,"protein_goal_g"?: number | null,"start_weight_kg"?: number | null,"updated_at"?: string,"user_id"?: string,"water_goal_ml"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_health_current_med_id_fkey"
      columns: ["current_med_id"]
isOneToOne: false
      referencedRelation: "medications"
      referencedColumns: ["med_id"]
    },{
      foreignKeyName: "user_health_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "users"
      referencedColumns: ["user_id"]
    }
                  ]
                },"users": {
                  Row: {
                    "created_at": string,"nickname": string | null,"onboarding_completed_at": string | null,"onboarding_step": number,"role": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"nickname"?: string | null,"onboarding_completed_at"?: string | null,"onboarding_step"?: number,"role"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"nickname"?: string | null,"onboarding_completed_at"?: string | null,"onboarding_step"?: number,"role"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "model_feedback": {
                  Row: {
                    "candidates": (string)[],"corrected_food_id": string | null,"created_at": string,"mode": string,"model_ver_id": string,"pred_id": string,"predicted_food_id": string,"score": number | null,"status": string,"threshold": number | null,"user_action": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "candidates"?: (string)[] | null,"corrected_food_id"?: string | null,"created_at"?: string | null,"mode"?: string | null,"model_ver_id"?: string | null,"pred_id"?: string | null,"predicted_food_id"?: string | null,"score"?: number | null,"status"?: string | null,"threshold"?: number | null,"user_action"?: string | null
                         }
                        Update: {
                           "candidates"?: (string)[] | null,"corrected_food_id"?: string | null,"created_at"?: string | null,"mode"?: string | null,"model_ver_id"?: string | null,"pred_id"?: string | null,"predicted_food_id"?: string | null,"score"?: number | null,"status"?: string | null,"threshold"?: number | null,"user_action"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "predictions_model_ver_id_fkey"
      columns: ["model_ver_id"]
isOneToOne: false
      referencedRelation: "model_versions"
      referencedColumns: ["model_ver_id"]
    }
                  ]
                }
          }
          Functions: {
            "has_consent":
{ Args: { "consent_type": string }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"nickname_available":
{ Args: { "name": string }; Returns: boolean
                           },
"show_limit":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"show_trgm":
{ Args: { "": string }; Returns: (string)[]
                           },
"withdraw_sensitive_consent":
{ Args: Record<PropertyKey, never>; Returns: Json
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
