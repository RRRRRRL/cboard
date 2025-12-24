<?php
/**
 * Other Routes Handlers (Location, Subscriber, Subscription, Analytics, GPT, Language, Login, Account)
 */

require_once __DIR__ . '/../auth.php';

function handleLocationRoutes($method, $pathParts, $data, $authToken) {
    // GET /location
    if ($method === 'GET' && count($pathParts) === 1) {
        // TODO: Get user location
        return successResponse([
            'country' => 'US',
            'region' => 'CA'
        ]);
    }
    return errorResponse('Location route not found', 404);
}

function handleSubscriberRoutes($method, $pathParts, $data, $authToken) {
    $user = requireAuth($authToken);
    
    // GET /subscriber/{userId}
    if ($method === 'GET' && count($pathParts) === 2) {
        // Frontend expects: {success: true, status, product, transaction}
        // Return default values for not subscribed user
        return successResponse([
            'success' => true,
            'status' => null,
            'product' => null,
            'transaction' => null
        ]);
    }
    
    // POST /subscriber
    if ($method === 'POST' && count($pathParts) === 1) {
        return successResponse(['success' => true, 'subscriber' => []]);
    }
    
    // POST /subscriber/cancel/{subscriptionId}
    if ($method === 'POST' && count($pathParts) === 3 && $pathParts[1] === 'cancel') {
        return successResponse(['success' => true, 'message' => 'Subscription cancelled']);
    }
    
    // PATCH /subscriber/{subscriberId}
    if ($method === 'PATCH' && count($pathParts) === 2) {
        return successResponse(['success' => true, 'subscriber' => []]);
    }
    
    // POST /subscriber/{subscriberId}/transaction
    if ($method === 'POST' && count($pathParts) === 3 && $pathParts[2] === 'transaction') {
        return successResponse(['success' => true, 'transaction' => []]);
    }
    
    return errorResponse('Subscriber route not found', 404);
}

function handleSubscriptionRoutes($method, $pathParts, $data, $authToken) {
    // GET /subscription/list (public endpoint - no auth required)
    if ($method === 'GET' && count($pathParts) === 2 && $pathParts[1] === 'list') {
        // TODO: Fetch subscription plans from database
        // Frontend expects an array directly, not wrapped in 'subscriptions' key
        return successResponse([]);
    }
    return errorResponse('Subscription route not found', 404);
}

function handleAnalyticsRoutes($method, $pathParts, $data, $authToken) {
    $user = requireAuth($authToken);
    
    // POST /analytics/batchGet
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'batchGet') {
        return successResponse(['analytics' => []]);
    }
    return errorResponse('Analytics route not found', 404);
}

function handleGPTRoutes($method, $pathParts, $data, $authToken) {
    $user = requireAuth($authToken);
    
    // Load Ollama helper
    require_once __DIR__ . '/../helpers/ollama.php';
    
    // POST /gpt/edit - Improve phrase using AI
    if ($method === 'POST' && count($pathParts) === 2 && $pathParts[1] === 'edit') {
        $phrase = $data['phrase'] ?? '';
        $language = $data['language'] ?? 'en';
        
        if (empty($phrase)) {
            return errorResponse('Phrase is required', 400);
        }
        
        try {
            $improvedPhrase = improvePhrase($phrase, $language);
            
            return successResponse([
                'phrase' => $improvedPhrase,
                'original' => $phrase,
                'improved' => $improvedPhrase !== $phrase
            ]);
        } catch (Exception $e) {
            error_log("GPT phrase improvement error: " . $e->getMessage());
            // Return original phrase if AI fails
            return successResponse([
                'phrase' => $phrase,
                'original' => $phrase,
                'improved' => false,
                'error' => 'AI service unavailable, returning original phrase'
            ]);
        }
    }
    return errorResponse('GPT route not found', 404);
}

function handleLanguageRoutes($method, $pathParts, $data, $authToken) {
    // GET /languages/{lang}
    if ($method === 'GET' && count($pathParts) === 2) {
        $lang = $pathParts[1];
        // TODO: Fetch language data
        return successResponse(['language' => $lang, 'data' => []]);
    }
    return errorResponse('Language route not found', 404);
}

function handleLoginRoutes($method, $pathParts, $data, $authToken) {
    // GET /login/{type}/callback
    if ($method === 'GET' && count($pathParts) === 3 && $pathParts[2] === 'callback') {
        $type = $pathParts[1]; // google, facebook, apple, etc.
        // TODO: Handle OAuth callback
        return successResponse([
            'success' => true,
            'user' => [
                'id' => 1,
                'email' => 'oauth@example.com',
                'name' => 'OAuth User',
                'authToken' => 'oauth-token-' . time()
            ]
        ]);
    }
    
    // POST /login/{type}/callback
    if ($method === 'POST' && count($pathParts) === 3 && $pathParts[2] === 'callback') {
        $type = $pathParts[1];
        // TODO: Handle OAuth callback (for Apple)
        return successResponse([
            'success' => true,
            'user' => [
                'id' => 1,
                'email' => 'oauth@example.com',
                'name' => 'OAuth User',
                'authToken' => 'oauth-token-' . time()
            ]
        ]);
    }
    
    return errorResponse('Login route not found', 404);
}

function handleAccountRoutes($method, $pathParts, $data, $authToken) {
    $user = requireAuth($authToken);
    
    // DELETE /account/{userId}
    if ($method === 'DELETE' && count($pathParts) === 2) {
        $userId = $pathParts[1];
        // TODO: Delete user account
        return successResponse(['success' => true, 'message' => 'Account deleted']);
    }
    return errorResponse('Account route not found', 404);
}

