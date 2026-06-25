import asyncio

import pytest
from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from fastapi_cache.decorator import cache


@pytest.fixture(autouse=True)
def _init_cache():
    FastAPICache.init(InMemoryBackend(), prefix="test-cache")
    yield


def test_cache_returns_same_value_within_ttl():
    calls = {"count": 0}

    @cache(expire=60, namespace="test_ns_1")
    async def handler():
        calls["count"] += 1
        return {"value": calls["count"]}

    first = asyncio.run(handler())
    second = asyncio.run(handler())

    assert first == {"value": 1}
    assert second == {"value": 1}
    assert calls["count"] == 1


def test_cache_expires_after_ttl():
    calls = {"count": 0}

    @cache(expire=1, namespace="test_ns_2")
    async def handler():
        calls["count"] += 1
        return {"value": calls["count"]}

    asyncio.run(handler())
    asyncio.run(asyncio.sleep(2.1))
    second = asyncio.run(handler())

    assert second == {"value": 2}
    assert calls["count"] == 2


def test_cache_clear_forces_recompute():
    calls = {"count": 0}

    @cache(expire=60, namespace="test_ns_3")
    async def handler():
        calls["count"] += 1
        return {"value": calls["count"]}

    asyncio.run(handler())
    asyncio.run(FastAPICache.clear(namespace="test_ns_3"))
    second = asyncio.run(handler())

    assert second == {"value": 2}
    assert calls["count"] == 2


def test_exception_inside_cached_function_is_not_cached():
    calls = {"count": 0}

    @cache(expire=60, namespace="test_ns_4")
    async def handler():
        calls["count"] += 1
        raise ValueError("boom")

    with pytest.raises(ValueError):
        asyncio.run(handler())
    with pytest.raises(ValueError):
        asyncio.run(handler())

    assert calls["count"] == 2
