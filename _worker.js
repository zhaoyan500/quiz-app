// _worker.js - Pages Functions 完整版
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

    // ==================== 根路径 - 返回 API 信息 ====================
    if (path === '/') {
      return new Response(JSON.stringify({
        status: 'ok',
        message: 'API is running! 后端已部署成功',
        endpoints: [
          'GET /api/users - 获取所有用户',
          'POST /api/users - 保存用户列表',
          'GET /api/user/:name - 获取单个用户',
          'PUT /api/user/:name - 更新用户积分',
          'GET /api/config - 获取配置',
          'POST /api/config - 保存配置',
          'GET /api/rank/team - 战队排行榜',
          'GET /api/rank/unit/:unit - 战队内部排行'
        ]
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==================== GET /api/users ====================
    if (path === '/api/users' && request.method === 'GET') {
      try {
        const result = await env.DB.prepare('SELECT * FROM users ORDER BY totalScore DESC').all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ 
          error: e.message,
          hint: '请检查 D1 绑定是否正确，数据库名称为 quiz-db'
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== POST /api/users ====================
    if (path === '/api/users' && request.method === 'POST') {
      try {
        const users = await request.json();
        
        // 清空所有用户
        await env.DB.prepare('DELETE FROM users').run();
        
        // 插入每个用户
        for (const user of users) {
          await env.DB.prepare(`
            INSERT INTO users (
              id, name, unit, pwd, 
              warmupScore, warmupDate, 
              rankScore, rankRemain, 
              challengeScore, challengeDate, 
              totalScore, time, 
              rankDaily_date, rankDaily_used, 
              warmupHistory, rankHistory, challengeHistory, 
              challengeUsed
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            user.id,
            user.name,
            user.unit,
            user.pwd,
            user.warmupScore || 0,
            user.warmupDate || '',
            user.rankScore || 0,
            user.rankRemain || 3,
            user.challengeScore || 0,
            user.challengeDate || '',
            user.totalScore || 0,
            user.time || new Date().toLocaleString(),
            user.rankDaily?.date || '',
            user.rankDaily?.used || 0,
            JSON.stringify(user.warmupHistory || []),
            JSON.stringify(user.rankHistory || []),
            JSON.stringify(user.challengeHistory || []),
            user.challengeUsed || 0
          ).run();
        }
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: `已保存 ${users.length} 个用户` 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== GET /api/user/:name ====================
    if (path.startsWith('/api/user/') && request.method === 'GET') {
      try {
        const name = path.replace('/api/user/', '');
        const result = await env.DB.prepare(
          'SELECT * FROM users WHERE name = ?'
        ).bind(name).first();
        
        if (!result) {
          return new Response(JSON.stringify({ error: '用户不存在' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== PUT /api/user/:name ====================
    if (path.startsWith('/api/user/') && request.method === 'PUT') {
      try {
        const name = path.replace('/api/user/', '');
        const userData = await request.json();
        
        const fields = [];
        const values = [];
        
        const updateFields = {
          warmupScore: userData.warmupScore,
          warmupDate: userData.warmupDate,
          rankScore: userData.rankScore,
          rankRemain: userData.rankRemain,
          challengeScore: userData.challengeScore,
          challengeDate: userData.challengeDate,
          totalScore: userData.totalScore,
          time: userData.time,
          rankDaily_date: userData.rankDaily?.date,
          rankDaily_used: userData.rankDaily?.used,
          warmupHistory: JSON.stringify(userData.warmupHistory || []),
          rankHistory: JSON.stringify(userData.rankHistory || []),
          challengeHistory: JSON.stringify(userData.challengeHistory || []),
          challengeUsed: userData.challengeUsed
        };
        
        for (const [key, value] of Object.entries(updateFields)) {
          if (value !== undefined && value !== null) {
            fields.push(`${key} = ?`);
            values.push(value);
          }
        }
        
        values.push(name);
        
        const sql = `UPDATE users SET ${fields.join(', ')} WHERE name = ?`;
        await env.DB.prepare(sql).bind(...values).run();
        
        const result = await env.DB.prepare(
          'SELECT * FROM users WHERE name = ?'
        ).bind(name).first();
        
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== GET /api/config ====================
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

    // ==================== POST /api/config ====================
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

    // ==================== GET /api/rank/team ====================
    if (path === '/api/rank/team' && request.method === 'GET') {
      try {
        const result = await env.DB.prepare(`
          SELECT unit, SUM(totalScore) as totalScore, COUNT(*) as memberCount
          FROM users 
          GROUP BY unit 
          ORDER BY totalScore DESC
        `).all();
        
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

    // ==================== GET /api/rank/unit/:unit ====================
    if (path.startsWith('/api/rank/unit/') && request.method === 'GET') {
      try {
        const unit = path.replace('/api/rank/unit/', '');
        const result = await env.DB.prepare(`
          SELECT * FROM users 
          WHERE unit = ? 
          ORDER BY totalScore DESC
        `).bind(unit).all();
        
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

    // ==================== 404 ====================
    return new Response(JSON.stringify({ 
      error: 'Not Found', 
      path: path,
      available: [
        'GET /api/users',
        'POST /api/users', 
        'GET /api/user/:name',
        'PUT /api/user/:name',
        'GET /api/config',
        'POST /api/config',
        'GET /api/rank/team',
        'GET /api/rank/unit/:unit'
      ]
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};
