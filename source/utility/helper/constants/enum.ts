export enum ActivityFlag {
    add = 1,
    edit = 2,
    delete = 3,
    de_active = 4,
    account_locked = 5
  }
  
  export enum ErrorCode {
    success = 200,
    updated = 204,
    failed = 400,
    exist = 409,
    not_exist = 404,
    exception = 500,
    not_verified = 401,
    token_required = 401,
    token_invalid = 401,
    invalid_credentials = 401,
    invalid_email = 401,
    invalid_phone = 401,
    get=200,
    unauthorized = 401,
    duplicate_entry=409,
    contact_company = 11,
    multiple_existance = 409,
    incorect_password = 401,
    not_verified_general_user = 403,
    no_access=403,
    server_error=500,
    de_active=403,
    delete_role_failed = 400,
    invalid_id=400,
    role_assigned=409,
    method_not_allowed = 405,
    partial_task_completion = 460,
    user_not_admin=403,
    rate_limited=429,
    locked_account=423,
  
  
    
  }
  export enum ErrorCodeInternal {
    success = 0,
    updated = 1,
    failed = 2,
    exist = 3,
    not_exist = 4,
    exception = 5,
    not_verified = 6,
    token_required = 7,
    token_invalid = 8,
    invalid_credentials = 9,
    get=200,
    unauthorized = 10,
    duplicate_entry=400,
    contact_company = 11,
    multiple_existance = 12,
    incorect_password = 13,
    not_verified_general_user = 14,
    no_access=15,
    email_found = 16,
    phone_found = 17,
    de_active=21,
    user_not_admin=22,
    invalid_t_pin=23,
    corporate_de_active=24,
    shop_de_active=25
   
  }
  
  export enum ResponseType {
    nothing = 0,
    single = 1,
    list = 2,
  }
  
  export enum FeaturedType {
    featured = 0,
    not_featured = 1,
  }
  
  export enum RoleType {
    customer = 0,
    employee = 1,
    receptionist = 2,
    system_user = 3,
  }
  
  export enum HttpStatus {
    ok = 200,
    bad_request = 400,
    not_found = 404,
    internal_server_error = 500,
  }
  
  export enum Verified {
    yes = 1,
    no = 6 //as  is assigned to not verified in error codes
  }
  export enum OmcUser {
    yes = 1,
    no = 0
  }
  export enum FuelStationUser {
    yes = 1,
    no = 0
  }

  //dev1
  export enum Owner {
    corporate = 1,
    omc = 2,
    fuel_station = 3,
    organization = 4,
    admin = 5,
    customer = 6,

  }

  //dev1
  export enum DefaultUser {
    omc_default_user = "6659ab27a13d3be51661b833",
    fuel_station_default_user = "667b9ae050930fae998b5e8c",
    corporate_default_user = "66853a5f1c9b87daa3c19202",
    admin_default_user = "66e3d9d44b9bb860a64f6cb5",
    customer_default_user = "679c82103b0886c3252411ec"
  }
  
  //dev1
  export enum defaultUser {
    yes = 1,
    no = 0
  }
  
  //dev1
  export enum getAllRoleStatus {
    required = 1,
    not_required = 0,
    only_deactive = 2
  }
  export enum ConsumerSignup{
    yes=1,
    no=0
   }

  //dev1
  export enum activeStatus {
    active = "active",
    inactive = "inactive",
    all = "all"
  }

  // ─── Super Admin / Admin / Merchant account model ──────────────────────────
  export enum AccountRole {
    super_admin = "super_admin",
    admin = "admin",
    merchant = "merchant",
  }

  export enum AccountStatus {
    active = "active",
    inactive = "inactive",
  }
