<?php
/**
 * WordPress REST proxy for provider-chatbot.
 *
 * Drop this in your theme's functions.php or a small plugin. It exposes
 *   POST /wp-json/myplugin/v1/chat
 * which forwards the conversation to OpenAI using a server-side key, so the
 * key is never exposed to the browser.
 *
 * Widget side (non-streaming JSON is simplest in PHP):
 *   Chatbot.init({ endpoint: '/wp-json/myplugin/v1/chat' });
 *
 * The widget POSTs { messages: [{role, content}] } and this returns
 * { "reply": "..." }, which provider-chatbot reads automatically.
 *
 * NOTE: PHP streaming (SSE) is fiddly behind most hosts; this example returns
 * a single JSON reply (stream: false on the widget, which is the default).
 */

add_action('rest_api_init', function () {
    register_rest_route('myplugin/v1', '/chat', [
        'methods'             => 'POST',
        // TODO: tighten for production (nonce / capability / rate limit).
        'permission_callback' => '__return_true',
        'callback'            => 'myplugin_chat_proxy',
    ]);
});

function myplugin_chat_proxy(WP_REST_Request $request) {
    $messages = $request->get_param('messages');
    if (!is_array($messages)) {
        return new WP_Error('bad_request', 'messages[] is required', ['status' => 400]);
    }

    // Store the key in wp-config.php (define('OPENAI_API_KEY', '...')) or an option.
    $api_key = defined('OPENAI_API_KEY') ? OPENAI_API_KEY : getenv('OPENAI_API_KEY');
    if (!$api_key) {
        return new WP_Error('config', 'OPENAI_API_KEY is not set', ['status' => 500]);
    }

    $response = wp_remote_post('https://api.openai.com/v1/chat/completions', [
        'timeout' => 60,
        'headers' => [
            'Content-Type'  => 'application/json',
            'Authorization' => 'Bearer ' . $api_key,
        ],
        'body' => wp_json_encode([
            'model'    => 'gpt-4o-mini',
            'messages' => $messages,
        ]),
    ]);

    if (is_wp_error($response)) {
        return new WP_Error('upstream', $response->get_error_message(), ['status' => 502]);
    }

    $data  = json_decode(wp_remote_retrieve_body($response), true);
    $reply = $data['choices'][0]['message']['content'] ?? '';

    return new WP_REST_Response(['reply' => $reply], 200);
}
