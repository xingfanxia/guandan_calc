/**
 * Export functionality module
 */

export class ExportManager {
  constructor(playerManager, gameLogic) {
    this.playerManager = playerManager;
    this.gameLogic = gameLogic;
  }

  exportToText() {
    const state = this.gameLogic.exportState();
    const players = this.playerManager.exportData();
    const history = state.history || [];
    
    let output = '掼蛋计算器 v8.0\n';
    output += '=' .repeat(50) + '\n\n';
    
    // Current status
    output += '当前状态\n';
    output += '-'.repeat(20) + '\n';
    output += `游戏模式：${state.mode}人模式\n`;
    output += `本局级牌：${state.roundLevel}\n`;
    output += `A队级别：${state.teamLevels.A}\n`;
    output += `B队级别：${state.teamLevels.B}\n\n`;
    
    // Players
    output += '玩家信息\n';
    output += '-'.repeat(20) + '\n';
    players.forEach(player => {
      output += `${player.emoji} ${player.name} - ${this.playerManager.getTeamName(player.team)}\n`;
    });
    output += '\n';
    
    // History
    output += '游戏历史\n';
    output += '-'.repeat(20) + '\n';
    
    if (history.length === 0) {
      output += '暂无历史记录\n';
    } else {
      history.forEach((entry, index) => {
        output += `第${index + 1}局：\n`;
        output += `  排名：(${entry.ranks.join(',')})\n`;
        output += `  胜方：${entry.winner === 'A' ? 'A队' : 'B队'} ↑${entry.levelUp}\n`;
        output += `  局后级别：A队:${entry.newLevels.A} B队:${entry.newLevels.B}\n`;
        output += `  本局级牌：${entry.roundLevel}\n`;
        
        if (entry.playerRankings) {
          output += '  玩家排名：\n';
          Object.entries(entry.playerRankings).forEach(([rank, data]) => {
            output += `    第${rank}名: ${data.emoji} ${data.name}\n`;
          });
        }
        output += '\n';
      });
    }
    
    // Statistics
    const stats = this.calculateStatistics();
    output += '统计数据\n';
    output += '-'.repeat(20) + '\n';
    output += `总局数：${history.length}\n`;
    output += `A队胜场：${stats.teamStats.A.wins} (${stats.teamStats.A.winRate}%)\n`;
    output += `B队胜场：${stats.teamStats.B.wins} (${stats.teamStats.B.winRate}%)\n`;
    output += `A队总升级：${stats.teamStats.A.totalUp}级\n`;
    output += `B队总升级：${stats.teamStats.B.totalUp}级\n\n`;
    
    output += '玩家统计\n';
    output += '-'.repeat(20) + '\n';
    Object.values(stats.playerStats).forEach(stat => {
      output += `${stat.emoji} ${stat.name}：平均排名 ${stat.avgRank}\n`;
    });
    
    output += '\n' + '='.repeat(50) + '\n';
    output += `导出时间：${new Date().toLocaleString('zh-CN')}\n`;
    
    return output;
  }

  exportToPNG(callback) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const state = this.gameLogic.exportState();
    const players = this.playerManager.exportData();
    const history = state.history || [];
    
    // Canvas dimensions
    const width = 2200;
    const rowHeight = 35;
    const headerHeight = 200;
    const footerHeight = 100;
    const height = headerHeight + (history.length * rowHeight) + footerHeight + 300;
    
    canvas.width = width;
    canvas.height = height;
    
    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Title
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('掼蛋计算器 v8.0 - 游戏记录', width / 2, 50);
    
    // Current status
    ctx.font = '24px Arial';
    ctx.textAlign = 'left';
    let y = 100;
    
    ctx.fillText(`游戏模式：${state.mode}人模式`, 50, y);
    ctx.fillText(`本局级牌：${state.roundLevel}`, 400, y);
    ctx.fillText(`A队：${state.teamLevels.A}`, 750, y);
    ctx.fillText(`B队：${state.teamLevels.B}`, 1000, y);
    
    // Players info
    y += 40;
    ctx.font = '20px Arial';
    ctx.fillText('玩家阵容：', 50, y);
    
    let x = 200;
    players.forEach(player => {
      const teamColor = player.team === 'A' ? '#ff6666' : '#6666ff';
      ctx.fillStyle = teamColor;
      ctx.fillText(`${player.emoji} ${player.name}`, x, y);
      x += 200;
      if (x > width - 200) {
        x = 200;
        y += 30;
      }
    });
    
    // History table header
    y += 60;
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('局数', 50, y);
    ctx.fillText('排名', 150, y);
    ctx.fillText('升级', 350, y);
    ctx.fillText('胜方', 450, y);
    ctx.fillText('局后级别', 550, y);
    ctx.fillText('本局级牌', 750, y);
    ctx.fillText('玩家排名详情', 900, y);
    
    // History rows
    ctx.font = '18px Arial';
    y += 35;
    
    history.forEach((entry, index) => {
      // Row background color
      const bgColor = entry.winner === 'A' ? '#ffeeee' : '#eeeeff';
      ctx.fillStyle = bgColor;
      ctx.fillRect(40, y - 25, width - 80, 30);
      
      // Row content
      ctx.fillStyle = '#333333';
      ctx.fillText(`${index + 1}`, 50, y);
      ctx.fillText(`(${entry.ranks.join(',')})`, 150, y);
      ctx.fillText(`↑${entry.levelUp}`, 350, y);
      ctx.fillText(entry.winner === 'A' ? 'A队' : 'B队', 450, y);
      ctx.fillText(`A:${entry.newLevels.A} B:${entry.newLevels.B}`, 550, y);
      ctx.fillText(entry.roundLevel || '-', 750, y);
      
      // Player rankings
      if (entry.playerRankings) {
        let rankX = 900;
        Object.entries(entry.playerRankings).forEach(([rank, data]) => {
          ctx.fillText(`${rank}.${data.emoji}${data.name}`, rankX, y);
          rankX += 150;
        });
      }
      
      y += rowHeight;
    });
    
    // Statistics
    y += 50;
    const stats = this.calculateStatistics();
    
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('游戏统计', 50, y);
    
    y += 35;
    ctx.font = '20px Arial';
    ctx.fillText(`总局数：${history.length}`, 50, y);
    ctx.fillText(`A队胜场：${stats.teamStats.A.wins} (${stats.teamStats.A.winRate}%)`, 300, y);
    ctx.fillText(`B队胜场：${stats.teamStats.B.wins} (${stats.teamStats.B.winRate}%)`, 600, y);
    
    y += 30;
    ctx.fillText(`A队总升级：${stats.teamStats.A.totalUp}级`, 50, y);
    ctx.fillText(`B队总升级：${stats.teamStats.B.totalUp}级`, 300, y);
    
    // Winner
    if (this.gameLogic.isGameFinished()) {
      y += 50;
      ctx.fillStyle = '#ff0000';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      const winner = this.gameLogic.getWinner();
      ctx.fillText(`🎉 ${winner === 'A' ? 'A队' : 'B队'} 获胜！🎉`, width / 2, y);
    }
    
    // Footer
    ctx.fillStyle = '#666666';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`导出时间：${new Date().toLocaleString('zh-CN')}`, width / 2, height - 30);
    
    // Convert to blob and trigger download
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `guandan_result_${new Date().getTime()}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      
      if (callback) callback();
    });
  }

  calculateStatistics() {
    const history = this.gameLogic.getHistory();
    const playerStats = {};
    const teamStats = {
      A: { wins: 0, totalUp: 0, winRate: 0 },
      B: { wins: 0, totalUp: 0, winRate: 0 }
    };
    
    // Initialize player stats
    this.playerManager.getPlayers().forEach(player => {
      playerStats[player.id] = {
        name: player.name,
        emoji: player.emoji,
        team: player.team,
        ranks: {},
        avgRank: 0
      };
    });
    
    // Process history
    history.forEach(entry => {
      teamStats[entry.winner].wins++;
      teamStats[entry.winner].totalUp += entry.levelUp;
      
      if (entry.playerRankings) {
        Object.entries(entry.playerRankings).forEach(([rank, data]) => {
          if (playerStats[data.id]) {
            playerStats[data.id].ranks[rank] = (playerStats[data.id].ranks[rank] || 0) + 1;
          }
        });
      }
    });
    
    // Calculate averages and rates
    const totalRounds = history.length;
    
    if (totalRounds > 0) {
      teamStats.A.winRate = ((teamStats.A.wins / totalRounds) * 100).toFixed(1);
      teamStats.B.winRate = ((teamStats.B.wins / totalRounds) * 100).toFixed(1);
    }
    
    Object.values(playerStats).forEach(stat => {
      let totalRank = 0;
      let count = 0;
      
      Object.entries(stat.ranks).forEach(([rank, times]) => {
        totalRank += parseInt(rank) * times;
        count += times;
      });
      
      stat.avgRank = count > 0 ? (totalRank / count).toFixed(2) : '-';
    });
    
    return { playerStats, teamStats };
  }

  importFromJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      
      if (data.gameState) {
        this.gameLogic.importState(data.gameState);
      }
      
      if (data.players) {
        this.playerManager.importData(data.players);
      }
      
      return true;
    } catch (error) {
      console.error('Import failed:', error);
      return false;
    }
  }

  exportToJSON() {
    const data = {
      version: '8.0',
      timestamp: new Date().toISOString(),
      gameState: this.gameLogic.exportState(),
      players: this.playerManager.exportData()
    };
    
    return JSON.stringify(data, null, 2);
  }
}