"""
Tests for backend/utils/arize_tracing.py

Tests cover:
- setup_arize() with various configurations
- instrument_* functions with idempotency
- get_tracer() with and without provider
- Thread safety and caching
"""

import pytest
from unittest.mock import MagicMock, patch, call
import threading
import time


@pytest.fixture(autouse=True)
def reset_module_state():
    """Reset module-level state before each test."""
    import backend.utils.arize_tracing as arize_module
    
    # Store original values
    original_enabled = arize_module._ARIZE_TRACING_ENABLED
    original_providers = arize_module._providers.copy()
    original_litellm = arize_module._litellm_instrumented
    original_dspy = arize_module._dspy_instrumented
    original_openai = arize_module._openai_agents_instrumented
    original_anthropic = arize_module._anthropic_instrumented
    original_ssl = arize_module._ssl_patched
    
    yield
    
    # Reset to original values after test
    arize_module._ARIZE_TRACING_ENABLED = original_enabled
    arize_module._providers.clear()
    arize_module._providers.update(original_providers)
    arize_module._litellm_instrumented = original_litellm
    arize_module._dspy_instrumented = original_dspy
    arize_module._openai_agents_instrumented = original_openai
    arize_module._anthropic_instrumented = original_anthropic
    arize_module._ssl_patched = original_ssl


# ============================================================================
# setup_arize() Tests
# ============================================================================

def test_setup_arize_returns_none_when_tracing_disabled(monkeypatch):
    """Test 1: Returns None when ARIZE_TRACING_ENABLED is false"""
    import backend.utils.arize_tracing as arize_module
    
    # Set tracing disabled
    arize_module._ARIZE_TRACING_ENABLED = False
    
    result = arize_module.setup_arize("test-project")
    
    assert result is None


def test_setup_arize_returns_none_when_api_key_missing(monkeypatch):
    """Test 2: Returns None when ARIZE_API_KEY is missing"""
    import backend.utils.arize_tracing as arize_module
    
    # Enable tracing but remove API key
    arize_module._ARIZE_TRACING_ENABLED = True
    arize_module._providers.clear()
    
    monkeypatch.setenv("ARIZE_SPACE_ID", "test-space")
    monkeypatch.delenv("ARIZE_API_KEY", raising=False)
    
    with patch.dict("os.environ", {"ARIZE_SPACE_ID": "test-space"}, clear=False):
        with patch("os.getenv") as mock_getenv:
            def getenv_side_effect(key, default=""):
                if key == "ARIZE_API_KEY":
                    return ""
                elif key == "ARIZE_SPACE_ID":
                    return "test-space"
                return default
            
            mock_getenv.side_effect = getenv_side_effect
            
            result = arize_module.setup_arize("test-project")
    
    assert result is None


def test_setup_arize_returns_none_when_space_id_missing(monkeypatch):
    """Test 3: Returns None when ARIZE_SPACE_ID is missing"""
    import backend.utils.arize_tracing as arize_module
    
    # Enable tracing but remove space ID
    arize_module._ARIZE_TRACING_ENABLED = True
    arize_module._providers.clear()
    
    with patch("os.getenv") as mock_getenv:
        def getenv_side_effect(key, default=""):
            if key == "ARIZE_API_KEY":
                return "test-key"
            elif key == "ARIZE_SPACE_ID":
                return ""
            return default
        
        mock_getenv.side_effect = getenv_side_effect
        
        result = arize_module.setup_arize("test-project")
    
    assert result is None


def test_setup_arize_creates_provider_on_first_call():
    """Test 4: Creates tracer provider on first call"""
    import backend.utils.arize_tracing as arize_module
    
    # Setup
    arize_module._ARIZE_TRACING_ENABLED = True
    arize_module._providers.clear()
    arize_module._ssl_patched = False
    
    mock_provider = MagicMock()
    
    with patch("os.getenv") as mock_getenv:
        def getenv_side_effect(key, default=""):
            if key == "ARIZE_API_KEY":
                return "test-key"
            elif key == "ARIZE_SPACE_ID":
                return "test-space"
            return default
        
        mock_getenv.side_effect = getenv_side_effect
        
        with patch("arize.otel.register") as mock_register:
            mock_register.return_value = mock_provider
            
            # Mock requests and urllib3 for SSL patching
            with patch("requests.Session"):
                with patch("urllib3.disable_warnings"):
                    result = arize_module.setup_arize("test-project")
    
    assert result is mock_provider
    assert "test-project" in arize_module._providers
    assert arize_module._providers["test-project"] is mock_provider
    assert arize_module._ssl_patched is True


def test_setup_arize_returns_cached_provider_on_subsequent_calls():
    """Test 5: Returns cached provider on subsequent calls with same project_name"""
    import backend.utils.arize_tracing as arize_module
    
    # Setup
    arize_module._ARIZE_TRACING_ENABLED = True
    arize_module._ssl_patched = True  # SSL already patched
    
    mock_provider = MagicMock()
    arize_module._providers.clear()
    arize_module._providers["test-project"] = mock_provider
    
    # Second call should return cached provider without calling register
    result = arize_module.setup_arize("test-project")
    
    assert result is mock_provider


def test_setup_arize_creates_separate_providers_for_different_projects():
    """Test 6: Creates separate providers for different project names"""
    import backend.utils.arize_tracing as arize_module
    
    # Setup
    arize_module._ARIZE_TRACING_ENABLED = True
    arize_module._providers.clear()
    arize_module._ssl_patched = True
    
    mock_provider_1 = MagicMock()
    mock_provider_2 = MagicMock()
    
    with patch("os.getenv") as mock_getenv:
        def getenv_side_effect(key, default=""):
            if key == "ARIZE_API_KEY":
                return "test-key"
            elif key == "ARIZE_SPACE_ID":
                return "test-space"
            return default
        
        mock_getenv.side_effect = getenv_side_effect
        
        with patch("arize.otel.register") as mock_register:
            mock_register.side_effect = [mock_provider_1, mock_provider_2]
            
            result_1 = arize_module.setup_arize("project-1")
            result_2 = arize_module.setup_arize("project-2")
    
    assert result_1 is mock_provider_1
    assert result_2 is mock_provider_2
    assert arize_module._providers["project-1"] is mock_provider_1
    assert arize_module._providers["project-2"] is mock_provider_2


def test_setup_arize_handles_import_error_gracefully():
    """Test 7: Handles arize-otel ImportError gracefully"""
    import backend.utils.arize_tracing as arize_module
    
    # Setup
    arize_module._ARIZE_TRACING_ENABLED = True
    arize_module._providers.clear()
    arize_module._ssl_patched = True
    
    with patch("os.getenv") as mock_getenv:
        def getenv_side_effect(key, default=""):
            if key == "ARIZE_API_KEY":
                return "test-key"
            elif key == "ARIZE_SPACE_ID":
                return "test-space"
            return default
        
        mock_getenv.side_effect = getenv_side_effect
        
        with patch("builtins.__import__", side_effect=ImportError("No module named 'arize.otel'")):
            result = arize_module.setup_arize("test-project")
    
    assert result is None


def test_setup_arize_handles_register_exception_gracefully():
    """Test 8: Handles register() exceptions gracefully"""
    import backend.utils.arize_tracing as arize_module
    
    # Setup
    arize_module._ARIZE_TRACING_ENABLED = True
    arize_module._providers.clear()
    arize_module._ssl_patched = True
    
    with patch("os.getenv") as mock_getenv:
        def getenv_side_effect(key, default=""):
            if key == "ARIZE_API_KEY":
                return "test-key"
            elif key == "ARIZE_SPACE_ID":
                return "test-space"
            return default
        
        mock_getenv.side_effect = getenv_side_effect
        
        with patch("arize.otel.register", side_effect=RuntimeError("Connection failed")):
            result = arize_module.setup_arize("test-project")
    
    assert result is None


def test_setup_arize_applies_ssl_patch_only_once():
    """Test 9: Applies SSL patch only once"""
    import backend.utils.arize_tracing as arize_module
    
    # Setup
    arize_module._ARIZE_TRACING_ENABLED = True
    arize_module._providers.clear()
    arize_module._ssl_patched = False
    
    mock_provider = MagicMock()
    
    with patch("os.getenv") as mock_getenv:
        def getenv_side_effect(key, default=""):
            if key == "ARIZE_API_KEY":
                return "test-key"
            elif key == "ARIZE_SPACE_ID":
                return "test-space"
            return default
        
        mock_getenv.side_effect = getenv_side_effect
        
        with patch("arize.otel.register") as mock_register:
            mock_register.return_value = mock_provider
            
            with patch("requests.Session"):
                with patch("urllib3.disable_warnings") as mock_disable_warnings:
                    # First call - should patch SSL
                    arize_module.setup_arize("project-1")
                    
                    # Reset providers to force second registration
                    arize_module._providers.clear()
                    
                    # Second call - should NOT patch SSL again
                    arize_module.setup_arize("project-2")
                    
                    # disable_warnings should only be called once
                    assert mock_disable_warnings.call_count == 1


# ============================================================================
# instrument_litellm() Tests
# ============================================================================

def test_instrument_litellm_does_nothing_when_provider_none():
    """Test 10: Does nothing when tracer_provider is None"""
    import backend.utils.arize_tracing as arize_module
    
    arize_module._litellm_instrumented = False
    
    # Should not raise
    arize_module.instrument_litellm(None)
    
    assert arize_module._litellm_instrumented is False


def test_instrument_litellm_applies_instrumentor_on_first_call():
    """Test 11: Applies instrumentor on first call"""
    import backend.utils.arize_tracing as arize_module
    
    arize_module._litellm_instrumented = False
    mock_provider = MagicMock()
    mock_instrumentor = MagicMock()
    
    with patch("openinference.instrumentation.litellm.LiteLLMInstrumentor") as mock_class:
        mock_class.return_value = mock_instrumentor
        
        arize_module.instrument_litellm(mock_provider)
    
    mock_instrumentor.instrument.assert_called_once_with(tracer_provider=mock_provider)
    assert arize_module._litellm_instrumented is True


def test_instrument_litellm_only_applies_once():
    """Test 12: Only applies instrumentor once (no-op on second call)"""
    import backend.utils.arize_tracing as arize_module
    
    arize_module._litellm_instrumented = False
    mock_provider = MagicMock()
    mock_instrumentor = MagicMock()
    
    with patch("openinference.instrumentation.litellm.LiteLLMInstrumentor") as mock_class:
        mock_class.return_value = mock_instrumentor
        
        # First call
        arize_module.instrument_litellm(mock_provider)
        # Second call
        arize_module.instrument_litellm(mock_provider)
    
    # Should only be called once
    mock_instrumentor.instrument.assert_called_once()


def test_instrument_litellm_handles_import_error():
    """Test 13: Handles ImportError gracefully"""
    import backend.utils.arize_tracing as arize_module
    
    arize_module._litellm_instrumented = False
    mock_provider = MagicMock()
    
    with patch("builtins.__import__", side_effect=ImportError("Module not found")):
        # Should not raise
        arize_module.instrument_litellm(mock_provider)
    
    # Should not set flag if import failed
    assert arize_module._litellm_instrumented is False


# ============================================================================
# instrument_dspy() Tests
# ============================================================================

def test_instrument_dspy_does_nothing_when_provider_none():
    """Test 14: Does nothing when tracer_provider is None"""
    import backend.utils.arize_tracing as arize_module
    
    arize_module._dspy_instrumented = False
    
    # Should not raise
    arize_module.instrument_dspy(None)
    
    assert arize_module._dspy_instrumented is False


def test_instrument_dspy_applies_instrumentor():
    """Test 15: Applies DSPy instrumentor"""
    import backend.utils.arize_tracing as arize_module
    
    arize_module._dspy_instrumented = False
    arize_module._litellm_instrumented = True  # Skip litellm instrumentation
    mock_provider = MagicMock()
    mock_instrumentor = MagicMock()
    
    with patch("openinference.instrumentation.dspy.DSPyInstrumentor") as mock_class:
        mock_class.return_value = mock_instrumentor
        
        arize_module.instrument_dspy(mock_provider)
    
    mock_instrumentor.instrument.assert_called_once_with(tracer_provider=mock_provider)
    assert arize_module._dspy_instrumented is True


def test_instrument_dspy_also_calls_instrument_litellm():
    """Test 16: Also calls instrument_litellm"""
    import backend.utils.arize_tracing as arize_module
    
    arize_module._dspy_instrumented = False
    arize_module._litellm_instrumented = False
    mock_provider = MagicMock()
    mock_dspy_instrumentor = MagicMock()
    mock_litellm_instrumentor = MagicMock()
    
    with patch("openinference.instrumentation.dspy.DSPyInstrumentor") as mock_dspy_class:
        mock_dspy_class.return_value = mock_dspy_instrumentor
        
        with patch("openinference.instrumentation.litellm.LiteLLMInstrumentor") as mock_litellm_class:
            mock_litellm_class.return_value = mock_litellm_instrumentor
            
            arize_module.instrument_dspy(mock_provider)
    
    # Both should be called
    mock_dspy_instrumentor.instrument.assert_called_once()
    mock_litellm_instrumentor.instrument.assert_called_once()
    assert arize_module._dspy_instrumented is True
    assert arize_module._litellm_instrumented is True


def test_instrument_dspy_only_applies_once():
    """Test 17: Only applies once"""
    import backend.utils.arize_tracing as arize_module
    
    arize_module._dspy_instrumented = False
    mock_provider = MagicMock()
    mock_instrumentor = MagicMock()
    
    with patch("openinference.instrumentation.dspy.DSPyInstrumentor") as mock_class:
        mock_class.return_value = mock_instrumentor
        
        with patch("backend.utils.arize_tracing.instrument_litellm"):
            # First call
            arize_module.instrument_dspy(mock_provider)
            # Second call
            arize_module.instrument_dspy(mock_provider)
    
    # Should only be called once
    mock_instrumentor.instrument.assert_called_once()


# ============================================================================
# instrument_anthropic() Tests
# ============================================================================

def test_instrument_anthropic_does_nothing_when_provider_none():
    """Test 18: Does nothing when tracer_provider is None"""
    import backend.utils.arize_tracing as arize_module
    
    arize_module._anthropic_instrumented = False
    
    # Should not raise
    arize_module.instrument_anthropic(None)
    
    assert arize_module._anthropic_instrumented is False


def test_instrument_anthropic_applies_instrumentor():
    """Test 19: Applies Anthropic instrumentor"""
    import backend.utils.arize_tracing as arize_module
    import sys
    
    arize_module._anthropic_instrumented = False
    mock_provider = MagicMock()
    mock_instrumentor = MagicMock()
    mock_anthropic_module = MagicMock()
    mock_anthropic_module.AnthropicInstrumentor.return_value = mock_instrumentor
    
    with patch.dict(sys.modules, {"openinference.instrumentation.anthropic": mock_anthropic_module}):
        arize_module.instrument_anthropic(mock_provider)
    
    mock_instrumentor.instrument.assert_called_once_with(tracer_provider=mock_provider)
    assert arize_module._anthropic_instrumented is True


def test_instrument_anthropic_only_applies_once():
    """Test 20: Only applies once"""
    import backend.utils.arize_tracing as arize_module
    import sys
    
    arize_module._anthropic_instrumented = False
    mock_provider = MagicMock()
    mock_instrumentor = MagicMock()
    mock_anthropic_module = MagicMock()
    mock_anthropic_module.AnthropicInstrumentor.return_value = mock_instrumentor
    
    with patch.dict(sys.modules, {"openinference.instrumentation.anthropic": mock_anthropic_module}):
        # First call
        arize_module.instrument_anthropic(mock_provider)
        # Second call
        arize_module.instrument_anthropic(mock_provider)
    
    # Should only be called once
    mock_instrumentor.instrument.assert_called_once()


# ============================================================================
# get_tracer() Tests
# ============================================================================

def test_get_tracer_returns_global_when_provider_none():
    """Test 21: Returns global tracer when provider is None"""
    import backend.utils.arize_tracing as arize_module
    
    mock_global_tracer = MagicMock()
    
    with patch("opentelemetry.trace.get_tracer") as mock_get_tracer:
        mock_get_tracer.return_value = mock_global_tracer
        
        result = arize_module.get_tracer(None, name="test")
    
    mock_get_tracer.assert_called_once_with("test")
    assert result is mock_global_tracer


def test_get_tracer_returns_provider_tracer_when_provider_exists():
    """Test 22: Returns tracer from provider when provider exists"""
    import backend.utils.arize_tracing as arize_module
    
    mock_provider = MagicMock()
    mock_provider_tracer = MagicMock()
    mock_provider.get_tracer.return_value = mock_provider_tracer
    
    result = arize_module.get_tracer(mock_provider, name="test")
    
    mock_provider.get_tracer.assert_called_once_with("test")
    assert result is mock_provider_tracer


# ============================================================================
# Thread Safety Tests
# ============================================================================

def test_setup_arize_thread_safety():
    """Test that concurrent calls to setup_arize with same project_name only create one provider"""
    import backend.utils.arize_tracing as arize_module
    
    arize_module._ARIZE_TRACING_ENABLED = True
    arize_module._providers.clear()
    arize_module._ssl_patched = True
    
    mock_provider = MagicMock()
    call_count = [0]
    
    def mock_register(*args, **kwargs):
        call_count[0] += 1
        time.sleep(0.01)  # Simulate some work
        return mock_provider
    
    with patch("os.getenv") as mock_getenv:
        def getenv_side_effect(key, default=""):
            if key == "ARIZE_API_KEY":
                return "test-key"
            elif key == "ARIZE_SPACE_ID":
                return "test-space"
            return default
        
        mock_getenv.side_effect = getenv_side_effect
        
        with patch("arize.otel.register", side_effect=mock_register):
            # Launch 5 threads trying to create the same provider
            threads = []
            results = []
            
            def setup_provider():
                result = arize_module.setup_arize("concurrent-project")
                results.append(result)
            
            for _ in range(5):
                t = threading.Thread(target=setup_provider)
                threads.append(t)
                t.start()
            
            for t in threads:
                t.join()
    
    # All threads should get the same provider
    assert len(set(id(r) for r in results)) == 1
    # register should only be called once due to locking
    assert call_count[0] == 1
