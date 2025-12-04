use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tauri_plugin_store::StoreExt;

use super::settings::get_api_key_internal;

const STORE_FILE: &str = "app-settings.json";
const DEFAULT_OPENAI_URL: &str = "https://api.openai.com/v1";

/// Get the configured API URL from the store, or use default
fn get_api_url(app: &tauri::AppHandle) -> String {
    app.store(STORE_FILE)
        .ok()
        .and_then(|store| {
            store.get("apiUrl")
                .and_then(|v| v.as_str().map(|s| s.to_string()))
        })
        .filter(|url| !url.is_empty())
        .unwrap_or_else(|| DEFAULT_OPENAI_URL.to_string())
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LLMOptions {
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub stream: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LLMResponse {
    pub content: String,
    pub usage: LLMUsage,
    pub finish_reason: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LLMUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LLMChunk {
    pub request_id: String,
    pub content: String,
    pub index: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LLMComplete {
    pub request_id: String,
    pub usage: LLMUsage,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LLMError {
    pub request_id: String,
    pub error: String,
}

/// Make a non-streaming LLM API request
/// 
/// This proxies the request through the backend for API key security
#[tauri::command]
pub async fn call_llm(
    app: tauri::AppHandle,
    provider: String,
    model: String,
    messages: Vec<ChatMessage>,
    options: LLMOptions,
) -> Result<LLMResponse, String> {
    // Get API key from keyring (stored via Settings), falling back to environment variable
    let api_key = match provider.as_str() {
        "openai" => {
            get_api_key_internal()
                .ok()
                .flatten()
                .or_else(|| std::env::var("OPENAI_API_KEY").ok())
        }
        "anthropic" => std::env::var("ANTHROPIC_API_KEY").ok(),
        "local" => Some("local".to_string()),
        _ => None,
    };

    let api_key = api_key.ok_or_else(|| {
        format!("LLM: No API key configured for provider '{}'. Please set your API key in Settings.", provider)
    })?;

    // Get API URL from settings (for OpenAI-compatible endpoints)
    let api_url = get_api_url(&app);

    // Build the request based on provider
    let client = reqwest::Client::new();
    
    let response = match provider.as_str() {
        "openai" => call_openai(&client, &api_url, &api_key, &model, &messages, &options).await,
        "anthropic" => call_anthropic(&client, &api_key, &model, &messages, &options).await,
        "local" => call_local(&client, &model, &messages, &options).await,
        _ => Err(format!("LLM: Unknown provider '{}'", provider)),
    }?;

    Ok(response)
}

/// Start a streaming LLM response
/// 
/// Emits 'llm-chunk' events for each token, 'llm-complete' when done, 'llm-error' on failure
#[tauri::command]
pub async fn stream_llm(
    request_id: String,
    provider: String,
    model: String,
    messages: Vec<ChatMessage>,
    options: LLMOptions,
    app: tauri::AppHandle,
) -> Result<(), String> {
    // Get API key from keyring (stored via Settings), falling back to environment variable
    let api_key = match provider.as_str() {
        "openai" => {
            get_api_key_internal()
                .ok()
                .flatten()
                .or_else(|| std::env::var("OPENAI_API_KEY").ok())
        }
        "anthropic" => std::env::var("ANTHROPIC_API_KEY").ok(),
        "local" => Some("local".to_string()),
        _ => None,
    };

    let api_key = api_key.ok_or_else(|| {
        format!("LLM: No API key configured for provider '{}'. Please set your API key in Settings.", provider)
    })?;

    // Get API URL from settings (for OpenAI-compatible endpoints)
    let api_url = get_api_url(&app);

    // Spawn async task for streaming
    let request_id_clone = request_id.clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        let result = match provider.as_str() {
            "openai" => {
                stream_openai(&app_clone, &request_id_clone, &api_url, &api_key, &model, &messages, &options).await
            }
            "anthropic" => {
                stream_anthropic(&app_clone, &request_id_clone, &api_key, &model, &messages, &options).await
            }
            "local" => {
                stream_local(&app_clone, &request_id_clone, &model, &messages, &options).await
            }
            _ => Err(format!("LLM: Unknown provider '{}'", provider)),
        };

        if let Err(e) = result {
            let _ = app_clone.emit("llm-error", LLMError {
                request_id: request_id_clone,
                error: e,
            });
        }
    });

    Ok(())
}

/// Cancel an ongoing LLM stream
#[tauri::command]
pub async fn cancel_llm_stream(request_id: String) -> Result<(), String> {
    // In a real implementation, we'd track active streams and cancel them
    // For now, just acknowledge the request
    log::info!("Cancelling LLM stream: {}", request_id);
    Ok(())
}

// OpenAI API implementation
async fn call_openai(
    client: &reqwest::Client,
    api_url: &str,
    api_key: &str,
    model: &str,
    messages: &[ChatMessage],
    options: &LLMOptions,
) -> Result<LLMResponse, String> {
    let openai_messages: Vec<serde_json::Value> = messages
        .iter()
        .map(|m| {
            serde_json::json!({
                "role": m.role,
                "content": m.content
            })
        })
        .collect();

    let body = serde_json::json!({
        "model": model,
        "messages": openai_messages,
        "temperature": options.temperature.unwrap_or(0.7),
        "max_tokens": options.max_tokens.unwrap_or(1000),
        "stream": false
    });

    let url = format!("{}/chat/completions", api_url);
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("LLM: Request failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("LLM: API error: {}", error_text));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("LLM: Failed to parse response: {}", e))?;

    let content = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string();

    let prompt_tokens = data["usage"]["prompt_tokens"].as_u64().unwrap_or(0) as u32;
    let completion_tokens = data["usage"]["completion_tokens"].as_u64().unwrap_or(0) as u32;
    let finish_reason = data["choices"][0]["finish_reason"]
        .as_str()
        .unwrap_or("stop")
        .to_string();

    Ok(LLMResponse {
        content,
        usage: LLMUsage {
            prompt_tokens,
            completion_tokens,
        },
        finish_reason,
    })
}

async fn stream_openai(
    app: &tauri::AppHandle,
    request_id: &str,
    api_url: &str,
    api_key: &str,
    model: &str,
    messages: &[ChatMessage],
    options: &LLMOptions,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    
    let openai_messages: Vec<serde_json::Value> = messages
        .iter()
        .map(|m| {
            serde_json::json!({
                "role": m.role,
                "content": m.content
            })
        })
        .collect();

    let body = serde_json::json!({
        "model": model,
        "messages": openai_messages,
        "temperature": options.temperature.unwrap_or(0.7),
        "max_tokens": options.max_tokens.unwrap_or(1000),
        "stream": true
    });

    let url = format!("{}/chat/completions", api_url);
    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("LLM: Request failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("LLM: API error: {}", error_text));
    }

    let mut stream = response.bytes_stream();
    let mut index = 0u32;
    let mut full_content = String::new();

    use futures_util::StreamExt;
    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);

        // Parse SSE format
        for line in text.lines() {
            if line.starts_with("data: ") {
                let data = &line[6..];
                if data == "[DONE]" {
                    break;
                }

                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(content) = parsed["choices"][0]["delta"]["content"].as_str() {
                        full_content.push_str(content);
                        let _ = app.emit("llm-chunk", LLMChunk {
                            request_id: request_id.to_string(),
                            content: content.to_string(),
                            index,
                        });
                        index += 1;
                    }
                }
            }
        }
    }

    // Emit completion
    let _ = app.emit("llm-complete", LLMComplete {
        request_id: request_id.to_string(),
        usage: LLMUsage {
            prompt_tokens: 0, // Would need to count from stream
            completion_tokens: index,
        },
    });

    Ok(())
}

// Anthropic API implementation
async fn call_anthropic(
    client: &reqwest::Client,
    api_key: &str,
    model: &str,
    messages: &[ChatMessage],
    options: &LLMOptions,
) -> Result<LLMResponse, String> {
    // Extract system message and convert messages
    let mut system_content = String::new();
    let anthropic_messages: Vec<serde_json::Value> = messages
        .iter()
        .filter_map(|m| {
            if m.role == "system" {
                system_content = m.content.clone();
                None
            } else {
                Some(serde_json::json!({
                    "role": if m.role == "assistant" { "assistant" } else { "user" },
                    "content": m.content
                }))
            }
        })
        .collect();

    let mut body = serde_json::json!({
        "model": model,
        "messages": anthropic_messages,
        "max_tokens": options.max_tokens.unwrap_or(1000),
    });

    if !system_content.is_empty() {
        body["system"] = serde_json::Value::String(system_content);
    }

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("LLM: Request failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("LLM: API error: {}", error_text));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("LLM: Failed to parse response: {}", e))?;

    let content = data["content"][0]["text"]
        .as_str()
        .unwrap_or("")
        .to_string();

    let input_tokens = data["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32;
    let output_tokens = data["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32;

    Ok(LLMResponse {
        content,
        usage: LLMUsage {
            prompt_tokens: input_tokens,
            completion_tokens: output_tokens,
        },
        finish_reason: "stop".to_string(),
    })
}

async fn stream_anthropic(
    app: &tauri::AppHandle,
    request_id: &str,
    api_key: &str,
    model: &str,
    messages: &[ChatMessage],
    options: &LLMOptions,
) -> Result<(), String> {
    let client = reqwest::Client::new();

    // Extract system message and convert messages
    let mut system_content = String::new();
    let anthropic_messages: Vec<serde_json::Value> = messages
        .iter()
        .filter_map(|m| {
            if m.role == "system" {
                system_content = m.content.clone();
                None
            } else {
                Some(serde_json::json!({
                    "role": if m.role == "assistant" { "assistant" } else { "user" },
                    "content": m.content
                }))
            }
        })
        .collect();

    let mut body = serde_json::json!({
        "model": model,
        "messages": anthropic_messages,
        "max_tokens": options.max_tokens.unwrap_or(1000),
        "stream": true
    });

    if !system_content.is_empty() {
        body["system"] = serde_json::Value::String(system_content);
    }

    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("LLM: Request failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("LLM: API error: {}", error_text));
    }

    let mut stream = response.bytes_stream();
    let mut index = 0u32;

    use futures_util::StreamExt;
    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);

        for line in text.lines() {
            if line.starts_with("data: ") {
                let data = &line[6..];
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(data) {
                    if parsed["type"] == "content_block_delta" {
                        if let Some(content) = parsed["delta"]["text"].as_str() {
                            let _ = app.emit("llm-chunk", LLMChunk {
                                request_id: request_id.to_string(),
                                content: content.to_string(),
                                index,
                            });
                            index += 1;
                        }
                    }
                }
            }
        }
    }

    let _ = app.emit("llm-complete", LLMComplete {
        request_id: request_id.to_string(),
        usage: LLMUsage {
            prompt_tokens: 0,
            completion_tokens: index,
        },
    });

    Ok(())
}

// Local LLM implementation (e.g., Ollama)
async fn call_local(
    client: &reqwest::Client,
    model: &str,
    messages: &[ChatMessage],
    options: &LLMOptions,
) -> Result<LLMResponse, String> {
    let local_url = std::env::var("LOCAL_LLM_URL")
        .unwrap_or_else(|_| "http://localhost:11434".to_string());

    let ollama_messages: Vec<serde_json::Value> = messages
        .iter()
        .map(|m| {
            serde_json::json!({
                "role": m.role,
                "content": m.content
            })
        })
        .collect();

    let body = serde_json::json!({
        "model": model,
        "messages": ollama_messages,
        "stream": false,
        "options": {
            "temperature": options.temperature.unwrap_or(0.7),
            "num_predict": options.max_tokens.unwrap_or(1000)
        }
    });

    let response = client
        .post(format!("{}/api/chat", local_url))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("LLM: Request failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("LLM: Local API error: {}", error_text));
    }

    let data: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("LLM: Failed to parse response: {}", e))?;

    let content = data["message"]["content"]
        .as_str()
        .unwrap_or("")
        .to_string();

    Ok(LLMResponse {
        content,
        usage: LLMUsage {
            prompt_tokens: 0,
            completion_tokens: 0,
        },
        finish_reason: "stop".to_string(),
    })
}

async fn stream_local(
    app: &tauri::AppHandle,
    request_id: &str,
    model: &str,
    messages: &[ChatMessage],
    options: &LLMOptions,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let local_url = std::env::var("LOCAL_LLM_URL")
        .unwrap_or_else(|_| "http://localhost:11434".to_string());

    let ollama_messages: Vec<serde_json::Value> = messages
        .iter()
        .map(|m| {
            serde_json::json!({
                "role": m.role,
                "content": m.content
            })
        })
        .collect();

    let body = serde_json::json!({
        "model": model,
        "messages": ollama_messages,
        "stream": true,
        "options": {
            "temperature": options.temperature.unwrap_or(0.7),
            "num_predict": options.max_tokens.unwrap_or(1000)
        }
    });

    let response = client
        .post(format!("{}/api/chat", local_url))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("LLM: Request failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("LLM: Local API error: {}", error_text));
    }

    let mut stream = response.bytes_stream();
    let mut index = 0u32;

    use futures_util::StreamExt;
    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("Stream error: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);

        for line in text.lines() {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(content) = parsed["message"]["content"].as_str() {
                    let _ = app.emit("llm-chunk", LLMChunk {
                        request_id: request_id.to_string(),
                        content: content.to_string(),
                        index,
                    });
                    index += 1;
                }
            }
        }
    }

    let _ = app.emit("llm-complete", LLMComplete {
        request_id: request_id.to_string(),
        usage: LLMUsage {
            prompt_tokens: 0,
            completion_tokens: index,
        },
    });

    Ok(())
}
