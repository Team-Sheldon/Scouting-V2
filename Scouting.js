/**
 * Scouting Management System
 * Handles team scouting reports display, filtering, and analysis
 */

class ScoutingManager {
    constructor() {
        this.API_BASE = 'https://api.teamsheldon.tech';
        this.currentPage = 1;
        this.teamsPerPage = parseInt(document.getElementById('teamsPerPage')?.value || '24', 10);
        this.allTeams = [];
        this.filteredTeams = [];
        this.currentSort = { field: 'teamNumber', direction: 'asc' };
        this.selectedTeam = null;

        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadUserInfo();
        this.updateStatusIndicators();
        await this.loadTeams();
    }

    async loadUserInfo() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                this.updateUserDisplay({
                    username: 'Admin User',
                    role: 'Administrator',
                    email: 'admin@teamsheldon.tech'
                });
                return;
            }

            const stored = localStorage.getItem('userInfo');
            if (stored) {
                this.updateUserDisplay(JSON.parse(stored));
            } else {
                const response = await fetch(`${this.API_BASE}/api/user/profile`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (response.ok) {
                    const userInfo = await response.json();
                    this.updateUserDisplay(userInfo);
                    localStorage.setItem('userInfo', JSON.stringify(userInfo));
                }
            }
        } catch (error) {
            console.error('Error loading user info:', error);
        }
    }

    updateUserDisplay(userInfo) {
        const username = userInfo.username || userInfo.name || 'Admin User';
        const userRole = userInfo.role || userInfo.userRole || 'Administrator';
        const userEmail = userInfo.email || userInfo.userEmail || 'admin@teamsheldon.tech';
        this.setElementText('sidebarUserName', username);
        this.setElementText('sidebarUserRole', userRole);
        this.setElementText('sidebarUserEmail', userEmail);
    }

    setElementText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    setupEventListeners() {
        document.getElementById('teamSearch')?.addEventListener('input', () => this.debounceFilter());
        document.getElementById('reliabilityFilter')?.addEventListener('change', () => this.applyFilters());
        document.getElementById('scoutFilter')?.addEventListener('change', () => this.applyFilters());
        document.getElementById('dateFilter')?.addEventListener('change', () => this.applyFilters());
        document.getElementById('teamsPerPage')?.addEventListener('change', () => this.changeTeamsPerPage());
        document.getElementById('sortBy')?.addEventListener('change', () => this.sortTeams());

        const checkbox = document.getElementById('confirmBulkDelete');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                const btn = document.getElementById('confirmBulkBtn');
                if (btn) btn.disabled = !e.target.checked;
            });
        }

        document.getElementById('teamsGrid')?.addEventListener('click', (e) => {
            const card = e.target.closest('.team-card');
            if (card && card.dataset.teamId) {
                this.showTeamDetails(card.dataset.teamId);
            }
        });

        this.setupNavigationHandlers();
    }

    setupNavigationHandlers() {
        const sidebarToggle = document.getElementById('sidebarToggle');
        const burgerMenuBtn = document.getElementById('burgerMenuBtn');
        if (sidebarToggle) sidebarToggle.addEventListener('click', () => this.toggleSidebar());
        if (burgerMenuBtn) burgerMenuBtn.addEventListener('click', () => this.toggleSidebar());
    }

    toggleSidebar() {
        const sidebar = document.getElementById('dashboardSidebar');
        const burgerMenuBtn = document.getElementById('burgerMenuBtn');
        if (sidebar) {
            sidebar.classList.toggle('hidden');
            if (burgerMenuBtn) {
                burgerMenuBtn.style.display = sidebar.classList.contains('hidden') ? 'flex' : 'none';
            }
        }
    }

    debounceFilter() {
        clearTimeout(this.filterTimeout);
        this.filterTimeout = setTimeout(() => this.applyFilters(), 300);
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.style.display = show ? 'flex' : 'none';
    }

    async loadTeams(showLoading = true) {
        try {
            if (showLoading) this.showLoading(true);
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${this.API_BASE}/api/teams`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                const data = await response.json();
                this.allTeams = Array.isArray(data) ? data : [];
            } else {
                throw new Error(`API error: ${response.status}`);
            }
        } catch (error) {
            console.error('Error loading teams:', error);
            showNotification('Failed to load scouting data', 'error');
            this.allTeams = [];
        } finally {
            if (showLoading) this.showLoading(false);
            this.populateScoutsFilter();
            this.applyFilters();
            this.updateStats();
        }
    }

    populateScoutsFilter() {
        const select = document.getElementById('scoutFilter');
        if (!select) return;
        const scouts = [...new Set(this.allTeams.map(t => t.scoutName || t.scout || t.scoutedBy || t.createdBy).filter(Boolean))].sort();
        select.innerHTML = '<option value="">All Scouts</option>' + scouts.map(s => `<option value="${s}">${s}</option>`).join('');
    }

    applyFilters() {
        const search = document.getElementById('teamSearch')?.value.toLowerCase() || '';
        const reliability = document.getElementById('reliabilityFilter')?.value;
        const scout = document.getElementById('scoutFilter')?.value.toLowerCase();
        const date = document.getElementById('dateFilter')?.value;

        this.filteredTeams = this.allTeams.filter(team => {
            const teamNumber = String(team.teamNumber || team.number || '').toLowerCase();
            const teamName = (team.teamName || team.name || '').toLowerCase();
            const scoutName = (team.scoutName || team.scout || team.scoutedBy || team.createdBy || '').toLowerCase();
            const reliabilityVal = team.reliability;
            const dateVal = team.date || team.createdAt || team.timestamp;

            if (search && !(teamNumber.includes(search) || teamName.includes(search) || scoutName.includes(search))) return false;
            if (reliability && reliabilityVal !== reliability) return false;
            if (scout && scoutName !== scout) return false;
            if (date && dateVal && !dateVal.startsWith(date)) return false;
            return true;
        });

        this.sortTeams(this.currentSort.field, false);
        this.currentPage = 1;
        this.renderTeams();
        this.updatePaginationInfo();
    }

    getFieldValue(team, field) {
        switch (field) {
            case 'teamNumber':
                return team.teamNumber || team.number || 0;
            case 'teamName':
                return team.teamName || team.name || '';
            case 'scoutName':
                return team.scoutName || team.scout || team.scoutedBy || team.createdBy || '';
            case 'date':
                return team.date || team.createdAt || team.timestamp || '';
            case 'reliability':
                return team.reliability || '';
            default:
                return '';
        }
    }

    sortTeams(field = document.getElementById('sortBy')?.value, updateDisplay = true) {
        if (!field) return;
        if (this.currentSort.field === field) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.field = field;
            this.currentSort.direction = 'asc';
        }
        const dir = this.currentSort.direction === 'asc' ? 1 : -1;
        this.filteredTeams.sort((a, b) => {
            const va = this.getFieldValue(a, field);
            const vb = this.getFieldValue(b, field);
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });
        if (updateDisplay) {
            this.currentPage = 1;
            this.renderTeams();
            this.updatePaginationInfo();
        }
    }

    renderTeams() {
        const grid = document.getElementById('teamsGrid');
        if (!grid) return;
        if (this.filteredTeams.length === 0) {
            grid.innerHTML = '<div class="loading-container"><span>No teams found</span></div>';
            this.setElementText('teamsCount', '0 teams');
            return;
        }
        const start = (this.currentPage - 1) * this.teamsPerPage;
        const end = start + this.teamsPerPage;
        const teamsToShow = this.filteredTeams.slice(start, end);
        grid.innerHTML = teamsToShow.map(team => `
            <div class="team-card" data-team-id="${team.id || team.teamNumber}">
                <div class="team-card-header">
                    <span class="team-number">${team.teamNumber || 'N/A'}</span>
                    <h3>${team.teamName || 'Unknown Team'}</h3>
                </div>
                <div class="team-card-body">
                    <p><i class="fas fa-user"></i> ${team.scoutName || team.scout || team.scoutedBy || team.createdBy || 'Unknown'}</p>
                    <p><i class="fas fa-star"></i> ${team.reliability || 'N/A'}</p>
                    <p><i class="fas fa-calendar-alt"></i> ${this.formatDate(team.date || team.createdAt || team.timestamp)}</p>
                </div>
            </div>
        `).join('');
        this.setElementText('teamsCount', `${this.filteredTeams.length} teams`);
    }

    formatDate(date) {
        if (!date) return 'Unknown';
        const d = new Date(date);
        if (isNaN(d)) return date;
        return d.toLocaleDateString();
    }

    updatePaginationInfo() {
        const totalPages = Math.max(1, Math.ceil(this.filteredTeams.length / this.teamsPerPage));
        const info = document.getElementById('paginationInfo');
        if (info) info.textContent = `Page ${this.currentPage} of ${totalPages}`;
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;
    }

    changeTeamsPerPage() {
        const select = document.getElementById('teamsPerPage');
        if (select) {
            this.teamsPerPage = parseInt(select.value, 10);
            this.currentPage = 1;
            this.renderTeams();
            this.updatePaginationInfo();
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.filteredTeams.length / this.teamsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderTeams();
            this.updatePaginationInfo();
        }
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderTeams();
            this.updatePaginationInfo();
        }
    }

    resetFilters() {
        const search = document.getElementById('teamSearch');
        const reliability = document.getElementById('reliabilityFilter');
        const scout = document.getElementById('scoutFilter');
        const date = document.getElementById('dateFilter');
        if (search) search.value = '';
        if (reliability) reliability.value = '';
        if (scout) scout.value = '';
        if (date) date.value = '';
        this.applyFilters();
    }

    async refreshScouting() {
        await this.loadTeams();
        showNotification('Scouting data refreshed', 'success');
    }

    exportScouting() {
        const data = JSON.stringify(this.filteredTeams, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scouting-data.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    showTeamDetails(id) {
        const team = this.allTeams.find(t => String(t.id || t.teamNumber) === String(id));
        if (!team) return;
        const modal = document.getElementById('teamDetailsModal');
        const content = document.getElementById('teamDetailsContent');
        const title = document.getElementById('modalTeamTitle');
        if (title) title.textContent = `Team ${team.teamNumber} - ${team.teamName || ''}`;
        if (content) {
            content.innerHTML = `
                <p><strong>Scout:</strong> ${team.scoutName || team.scout || team.scoutedBy || team.createdBy || 'Unknown'}</p>
                <p><strong>Reliability:</strong> ${team.reliability || 'N/A'}</p>
                <p><strong>Date:</strong> ${this.formatDate(team.date || team.createdAt || team.timestamp)}</p>
                ${team.notes ? `<p><strong>Notes:</strong> ${team.notes}</p>` : ''}
            `;
        }
        if (modal) modal.classList.add('show');
        this.selectedTeam = team;
    }

    closeTeamModal() {
        document.getElementById('teamDetailsModal')?.classList.remove('show');
        this.selectedTeam = null;
    }

    editTeam() {
        if (!this.selectedTeam) return;
        showNotification('Edit team feature not implemented', 'warning');
    }

    async deleteTeam() {
        if (!this.selectedTeam) return;
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${this.API_BASE}/api/teams/${this.selectedTeam.id || this.selectedTeam.teamNumber}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                showNotification('Team deleted', 'success');
                this.allTeams = this.allTeams.filter(t => t !== this.selectedTeam);
                this.applyFilters();
                this.closeTeamModal();
            } else {
                showNotification('Failed to delete team', 'error');
            }
        } catch (error) {
            console.error('Delete team error:', error);
            showNotification('Failed to delete team', 'error');
        }
    }

    bulkDeleteTeams() {
        const modal = document.getElementById('bulkDeleteModal');
        if (modal) modal.classList.add('show');
    }

    closeBulkDeleteModal() {
        const modal = document.getElementById('bulkDeleteModal');
        if (modal) modal.classList.remove('show');
        const checkbox = document.getElementById('confirmBulkDelete');
        if (checkbox) checkbox.checked = false;
        const btn = document.getElementById('confirmBulkBtn');
        if (btn) btn.disabled = true;
    }

    confirmBulkDelete() {
        this.closeBulkDeleteModal();
        showNotification('Bulk delete not implemented', 'warning');
    }

    updateStats() {
        const totalTeams = this.allTeams.length;
        this.setElementText('totalTeams', totalTeams);
        const today = new Date().toISOString().split('T')[0];
        const teamsToday = this.allTeams.filter(t => (t.date || t.createdAt || '').startsWith(today)).length;
        this.setElementText('teamsToday', `${teamsToday} today`);

        const scoutSet = new Set(this.allTeams.map(t => t.scoutName || t.scout || t.scoutedBy || t.createdBy).filter(Boolean));
        this.setElementText('totalScouts', scoutSet.size);
        const scoutTodaySet = new Set(this.allTeams.filter(t => (t.date || t.createdAt || '').startsWith(today)).map(t => t.scoutName || t.scout || t.scoutedBy || t.createdBy).filter(Boolean));
        this.setElementText('scoutsToday', `${scoutTodaySet.size} today`);

        const reliabilityMap = { 'Very Low': 1, 'Low': 2, 'Medium': 3, 'High': 4, 'Very High': 5 };
        const reliabilities = this.allTeams.map(t => reliabilityMap[t.reliability]).filter(Boolean);
        if (reliabilities.length) {
            const avg = reliabilities.reduce((a, b) => a + b, 0) / reliabilities.length;
            this.setElementText('avgReliability', `${avg.toFixed(2)}/5`);
        } else {
            this.setElementText('avgReliability', 'N/A');
        }
        this.setElementText('reliabilityTrend', '--');

        const recentCount = this.allTeams.filter(t => {
            const d = new Date(t.date || t.createdAt || t.timestamp);
            return Date.now() - d.getTime() <= 7 * 24 * 60 * 60 * 1000;
        }).length;
        this.setElementText('recentReports', recentCount);
        this.setElementText('reportsToday', `${teamsToday} today`);
    }

    updateStatusIndicators() {
        this.checkAPIStatus();
        setInterval(() => this.checkAPIStatus(), 30000);
    }

    async checkAPIStatus() {
        const apiIndicator = document.getElementById('apiStatus');
        const dbIndicator = document.getElementById('dbStatus');
        try {
            const response = await fetch(`${this.API_BASE}/health`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                if (apiIndicator) apiIndicator.className = 'status-indicator online';
                if (dbIndicator) dbIndicator.className = 'status-indicator online';
            } else {
                throw new Error('API not responding');
            }
        } catch (error) {
            try {
                const testResponse = await fetch(`${this.API_BASE}/api/teams`, {
                    method: 'HEAD',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (testResponse.status !== 404) {
                    if (apiIndicator) apiIndicator.className = 'status-indicator online';
                    if (dbIndicator) dbIndicator.className = 'status-indicator online';
                } else {
                    throw new Error('API not available');
                }
            } catch (secondError) {
                if (apiIndicator) apiIndicator.className = 'status-indicator offline';
                if (dbIndicator) dbIndicator.className = 'status-indicator offline';
            }
        }
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        const manager = new ScoutingManager();
        window.scouting = manager;
        window.refreshScouting = () => manager.refreshScouting();
        window.exportScouting = () => manager.exportScouting();
        window.bulkDeleteTeams = () => manager.bulkDeleteTeams();
        window.previousPage = () => manager.previousPage();
        window.nextPage = () => manager.nextPage();
        window.changeTeamsPerPage = () => manager.changeTeamsPerPage();
        window.sortTeams = () => manager.sortTeams();
        window.resetFilters = () => manager.resetFilters();
        window.closeTeamModal = () => manager.closeTeamModal();
        window.editTeam = () => manager.editTeam();
        window.deleteTeam = () => manager.deleteTeam();
        window.closeBulkDeleteModal = () => manager.closeBulkDeleteModal();
        window.confirmBulkDelete = () => manager.confirmBulkDelete();
    });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScoutingManager;
}

