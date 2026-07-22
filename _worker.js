// _worker.js - 只处理 API，不处理根路径
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ==================== API 路由 ====================
    
    // GET /api/users
    if (path === '/api/users' && request.method === 'GET') {
      try {
        const result = await env.DB.prepare('SELECT * FROM users ORDER BY totalScore DESC').all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // POST /api/users
    if (path === '/api/users' && request.method === 'POST') {
      try {
        const users = await request.json();
        await env.DB.prepare('DELETE FROM users').run();
        for (const user of users) {
          await env.DB.prepare(`
            INSERT INTO users (id, name, unit, pwd, warmupScore, warmupDate, rankScore, rankRemain, 
            challengeScore, challengeDate, totalScore, time, rankDaily_date, rankDaily_used, 
            warmupHistory, rankHistory, challengeHistory, challengeUsed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            user.id, user.name, user.unit, user.pwd,
            user.warmupScore || 0, user.warmupDate || '',
            user.rankScore || 0, user.rankRemain || 3,
            user.challengeScore || 0, user.challengeDate || '',
            user.totalScore || 0, user.time || '',
            user.rankDaily?.date || '', user.rankDaily?.used || 0,
            JSON.stringify(user.warmupHistory || []),
            JSON.stringify(user.rankHistory || []),
            JSON.stringify(user.challengeHistory || []),
            user.challengeUsed || 0
          ).run();
        }
        return new Response(JSON.stringify({ success: true, count: users.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /api/config
    if (path === '/api/config' && request.method === 'GET') {
      try {
        const config = await env.KV.get('app_config', 'json');
        if (config) {
          return new Response(JSON.stringify(config), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const defaultConfig = {
          warmup: true,
          ranked: true,
          challenge: true,
          timer: true,
          combo: true,
          soundEffect: 'crisp'
        };
        await env.KV.put('app_config', JSON.stringify(defaultConfig));
        return new Response(JSON.stringify(defaultConfig), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // POST /api/config
    if (path === '/api/config' && request.method === 'POST') {
      try {
        const config = await request.json();
        await env.KV.put('app_config', JSON.stringify(config));
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== 非 API 请求 ====================
    // 让 Pages 处理（返回 index.html）
    return new Response(null, {
      status: 404,
      headers: corsHeaders
    });
  }
};
