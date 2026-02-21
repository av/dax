export class LLMClient {
    currentAbortController = null;
    /**
     * Abort the currently in-flight request, if any.
     * Safe to call even when no request is active.
     */
    abortCurrentRequest() {
        if (this.currentAbortController) {
            this.currentAbortController.abort();
            this.currentAbortController = null;
        }
    }
    /**
     * Send messages to an OpenAI-compatible chat completions endpoint.
     * Returns the assistant's response content string.
     */
    async sendMessage(messages, config) {
        // Abort any previous in-flight request before starting a new one
        this.abortCurrentRequest();
        const abortController = new AbortController();
        this.currentAbortController = abortController;
        const url = this.buildURL(config.apiEndpoint);
        const headers = this.buildHeaders(config.apiKey);
        const body = JSON.stringify({
            model: config.modelName,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            temperature: config.temperature,
            max_tokens: config.maxTokens,
        });
        let response;
        try {
            response = await fetch(url, { method: 'POST', headers, body, signal: abortController.signal });
        }
        catch (err) {
            // Clean up controller reference on failure
            if (this.currentAbortController === abortController) {
                this.currentAbortController = null;
            }
            if (err instanceof DOMException && err.name === 'AbortError') {
                throw new Error('Request aborted');
            }
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Network error: ${message}`);
        }
        if (!response.ok) {
            const errorMessage = await this.parseErrorResponse(response);
            throw new Error(errorMessage);
        }
        const data = (await response.json());
        if (!data.choices || data.choices.length === 0) {
            throw new Error('No response from model — empty choices array');
        }
        const content = data.choices[0].message?.content;
        if (typeof content !== 'string') {
            throw new Error('Invalid response format — missing message content');
        }
        // Clean up controller reference on success
        if (this.currentAbortController === abortController) {
            this.currentAbortController = null;
        }
        return content;
    }
    /**
     * Test the connection by sending a minimal prompt.
     * Returns true if the API responds successfully.
     */
    async testConnection(config) {
        const testMessages = [
            { role: 'user', content: 'Reply with exactly: ok' },
        ];
        const testConfig = {
            ...config,
            maxTokens: 16,
            temperature: 0,
        };
        await this.sendMessage(testMessages, testConfig);
        return true;
    }
    buildURL(endpoint) {
        const base = endpoint.replace(/\/+$/, '');
        if (base.endsWith('/chat/completions')) {
            return base;
        }
        return `${base}/chat/completions`;
    }
    buildHeaders(apiKey) {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }
        return headers;
    }
    async parseErrorResponse(response) {
        const status = response.status;
        let bodyText;
        try {
            bodyText = await response.text();
        }
        catch {
            return `API error (${status})`;
        }
        try {
            const parsed = JSON.parse(bodyText);
            if (parsed.error?.message) {
                return `API error (${status}): ${parsed.error.message}`;
            }
        }
        catch {
            // Not JSON — fall through
        }
        switch (status) {
            case 401:
                return 'Authentication failed — check your API key';
            case 403:
                return 'Access denied — your API key may lack the required permissions';
            case 404:
                return 'Endpoint not found — check your API endpoint URL and model name';
            case 429:
                return 'Rate limited — too many requests, please try again later';
            case 500:
            case 502:
            case 503:
                return `Server error (${status}) — the API server is experiencing issues`;
            default:
                return `API error (${status}): ${bodyText.slice(0, 200)}`;
        }
    }
}
