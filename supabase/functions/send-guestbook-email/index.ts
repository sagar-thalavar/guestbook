import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const adminEmail = Deno.env.get('ADMIN_EMAIL') ?? 'sagar.thalavar509@gmail.com';

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const payload = await req.json();

    console.log('Received Webhook Payload:', JSON.stringify(payload, null, 2));

    const { type, table, record, old_record } = payload;

    if (table !== 'guestbook_entries') {
      return new Response(JSON.stringify({ message: 'Ignored: not guestbook_entries table' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    let emailTo = '';
    let emailSubject = '';
    let emailHtml = '';
    let shouldSend = false;

    // A. Handle Insert (New entry pending moderation)
    if (type === 'INSERT') {
      shouldSend = true;
      emailTo = adminEmail;
      emailSubject = `🔔 New Guestbook Submission from ${record.original_name}`;
      emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0;">New Guestbook Entry Pending Moderation</h2>
          <p style="color: #334155; font-size: 16px; line-height: 1.5;">A new visitor has logged a memory. Please review it inside the Admin Portal.</p>
          <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0 0 8px; color: #475569; font-size: 14px;"><strong>Visitor:</strong> ${record.original_name}</p>
            <p style="margin: 0 0 8px; color: #475569; font-size: 14px;"><strong>Mood:</strong> ${record.mood || 'None'}</p>
            <p style="margin: 0; color: #475569; font-size: 14px; font-style: italic;">"${record.message}"</p>
          </div>
          <a href="https://sagarthalavar.in/guestbook" style="display: inline-block; padding: 12px 24px; border-radius: 99px; background-color: #1e293b; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">Open Moderation Portal</a>
        </div>
      `;
    }

    // B. Handle Update (Status changed or replacement submitted)
    if (type === 'UPDATE') {
      const statusChanged = old_record.status !== record.status;

      // Case 1: Status updated to Approved
      if (statusChanged && record.status === 'approved') {
        shouldSend = true;
        // Fetch visitor email from profiles
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', record.user_id)
          .single();

        if (error || !profile) {
          throw new Error(`Failed to fetch visitor profile: ${error?.message || 'Not found'}`);
        }

        emailTo = profile.email;
        emailSubject = `✨ Your Guestbook entry has been approved!`;
        emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #0f172a; margin-top: 0;">Your Memory is Stored!</h2>
            <p style="color: #334155; font-size: 16px; line-height: 1.5;">Hi ${record.original_name},</p>
            <p style="color: #334155; font-size: 16px; line-height: 1.5;">We are happy to let you know that your guestbook entry has been reviewed and approved! It is now securely archived in your visitor record.</p>
            <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 8px; color: #475569; font-size: 14px;"><strong>Mood:</strong> ${record.mood || 'None'}</p>
              <p style="margin: 0; color: #475569; font-size: 14px; font-style: italic;">"${record.message}"</p>
            </div>
            <a href="https://sagarthalavar.in/guestbook" style="display: inline-block; padding: 12px 24px; border-radius: 99px; background-color: #1e293b; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">View Your Archive</a>
          </div>
        `;
      }

      // Case 2: Status updated to Rejected
      if (statusChanged && record.status === 'rejected') {
        shouldSend = true;
        // Fetch visitor email from profiles
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', record.user_id)
          .single();

        if (error || !profile) {
          throw new Error(`Failed to fetch visitor profile: ${error?.message || 'Not found'}`);
        }

        const friendlyReasons: Record<string, string> = {
          unclear_photo: 'Unclear Photo (e.g. blur, low lighting)',
          inappropriate_content: 'Inappropriate Content',
          image_not_visitor: 'Image does not show visitor (e.g. blank background)',
          duplicate_submission: 'Duplicate Submission',
          spam_submission: 'Spam/Abuse Submission',
          other: record.custom_rejection_reason || 'Moderator Decision'
        };

        const reason = friendlyReasons[record.rejection_reason] || 'Moderator Decision';

        emailTo = profile.email;
        emailSubject = `⚠️ Your Guestbook entry needs an adjustment`;
        emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ef4444; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #ef4444; margin-top: 0;">Re-upload Required</h2>
            <p style="color: #334155; font-size: 16px; line-height: 1.5;">Hi ${record.original_name},</p>
            <p style="color: #334155; font-size: 16px; line-height: 1.5;">Your guestbook entry requires a minor adjustment before it can be approved.</p>
            <div style="background-color: #fef2f2; padding: 16px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;">
              <p style="margin: 0; color: #991b1b; font-size: 14px;"><strong>Reason for Re-upload:</strong> ${reason}</p>
            </div>
            <p style="color: #334155; font-size: 16px; line-height: 1.5;">Please log back in to your dashboard and click "Replace Submission" to update your photo or message. (Attempts: ${record.reupload_attempts}/3)</p>
            <a href="https://sagarthalavar.in/guestbook" style="display: inline-block; padding: 12px 24px; border-radius: 99px; background-color: #ef4444; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">Replace Submission</a>
          </div>
        `;
      }

      // Case 3: Re-upload submitted (status goes from rejected back to pending)
      if (old_record.status === 'rejected' && record.status === 'pending') {
        shouldSend = true;
        emailTo = adminEmail;
        emailSubject = `🔄 Guestbook Re-upload from ${record.original_name}`;
        emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #0f172a; margin-top: 0;">Guestbook Re-submission</h2>
            <p style="color: #334155; font-size: 16px; line-height: 1.5;">Visitor <strong>${record.original_name}</strong> has replaced their rejected entry (Attempt ${record.reupload_attempts}/3). It is pending review.</p>
            <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0 0 8px; color: #475569; font-size: 14px;"><strong>Visitor:</strong> ${record.original_name}</p>
              <p style="margin: 0 0 8px; color: #475569; font-size: 14px;"><strong>Mood:</strong> ${record.mood || 'None'}</p>
              <p style="margin: 0; color: #475569; font-size: 14px; font-style: italic;">"${record.message}"</p>
            </div>
            <a href="https://sagarthalavar.in/guestbook" style="display: inline-block; padding: 12px 24px; border-radius: 99px; background-color: #1e293b; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px;">Moderate Entry</a>
          </div>
        `;
      }
    }

    if (shouldSend && resendApiKey) {
      console.log(`Sending email to: ${emailTo} via Resend...`);
      
      const emailPayload = {
        from: 'Guestbook <admin@sagarthalavar.in>',
        to: [emailTo],
        subject: emailSubject,
        html: emailHtml,
      };

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailPayload),
      });

      const resText = await res.text();
      console.log('Resend Response:', res.status, resText);

      if (!res.ok) {
        throw new Error(`Resend email dispatch failed: ${resText}`);
      }
    } else {
      console.log('Notification criteria not met or RESEND_API_KEY missing.');
    }

    return new Response(JSON.stringify({ success: true, message: 'Processed successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
