use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::Mutex;
use tauri::{command, State};

/// Holds the bound listener between the bind and await calls.
pub struct OAuthListenerState(pub Mutex<Option<TcpListener>>);

#[command]
pub fn bind_oauth_listener(
    state: State<'_, OAuthListenerState>,
) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind: {}", e))?;
    let port = listener.local_addr().unwrap().port();
    *state.0.lock().unwrap() = Some(listener);
    Ok(port)
}

#[command]
pub fn await_oauth_redirect(
    state: State<'_, OAuthListenerState>,
) -> Result<String, String> {
    let listener = state
        .0
        .lock()
        .unwrap()
        .take()
        .ok_or("No listener bound — call bind_oauth_listener first")?;

    let (mut stream, _) = listener
        .accept()
        .map_err(|e| format!("Failed to accept: {}", e))?;

    let mut buffer = [0u8; 4096];
    let bytes_read = stream
        .read(&mut buffer)
        .map_err(|e| format!("Failed to read: {}", e))?;

    let request = String::from_utf8_lossy(&buffer[..bytes_read]);

    if let Some(error) = extract_query_param(&request, "error") {
        let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n\
            <html><body><h2>Sign-in cancelled</h2>\
            <p>You can close this tab.</p></body></html>";
        stream.write_all(response.as_bytes()).ok();
        return Err(format!("OAuth error: {}", error));
    }

    let code =
        extract_query_param(&request, "code").ok_or("No auth code in redirect")?;

    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n\
        <html><body><h2>\u{2713} Signed in to PUGs Balancer</h2>\
        <p>You can close this tab and return to the app.</p></body></html>";
    stream.write_all(response.as_bytes()).ok();

    Ok(code)
}

fn extract_query_param(request: &str, param: &str) -> Option<String> {
    let first_line = request.lines().next()?;
    let path = first_line.split_whitespace().nth(1)?;
    let query = path.split('?').nth(1)?;
    for pair in query.split('&') {
        let mut kv = pair.splitn(2, '=');
        if let (Some(key), Some(value)) = (kv.next(), kv.next()) {
            if key == param {
                return Some(url_decode(value));
            }
        }
    }
    None
}

fn url_decode(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut bytes = s.bytes();
    while let Some(b) = bytes.next() {
        if b == b'%' {
            let hi = bytes.next().and_then(|c| (c as char).to_digit(16));
            let lo = bytes.next().and_then(|c| (c as char).to_digit(16));
            if let (Some(h), Some(l)) = (hi, lo) {
                result.push((h * 16 + l) as u8 as char);
            }
        } else if b == b'+' {
            result.push(' ');
        } else {
            result.push(b as char);
        }
    }
    result
}
