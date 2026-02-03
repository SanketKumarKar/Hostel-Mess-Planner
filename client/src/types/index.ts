export interface Feedback {
    id: string;
    student_id: string;
    caterer_id: string;
    message: string;
    response?: string;
    created_at: string;

    // Joined fields (optional, depending on query)
    caterer?: {
        full_name: string;
        mess_type: string;
    };
    student?: {
        full_name: string;
        reg_number: string;
    };
}

export interface SystemSetting {
    setting_key: string;
    setting_value: string; // 'true' | 'false'
}

export interface Profile {
    id: string;
    full_name: string;
    role: 'student' | 'caterer' | 'admin';
    mess_type?: 'veg' | 'non_veg' | 'special';
    reg_number?: string;
    created_at: string;
}
