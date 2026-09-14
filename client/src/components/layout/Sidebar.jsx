import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Trophy, User, Lightbulb,
  ClipboardList, Component, Settings, LogOut,
  Link2Off, ShieldAlert, FlaskConical, Ticket,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

const NAV_ITEMS = [
  { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard'   },
  { to: '/scoreboard',  icon: Trophy,          label: 'Scoreboard'  },
  { to: '/progress',    icon: User,            label: 'My progress' },
  // { to: '/hints',       icon: Lightbulb,       label: 'Hints used'  },
  { to: '/assessment',  icon: ClipboardList,   label: 'Assessment'  },
  // { to: '/components',  icon: Component,       label: 'Components'  },
  // { to: '/settings',    icon: Settings,        label: 'Settings'    },
]

export function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const initials = user?.username?.slice(0, 2).toUpperCase() || 'CB'

  const roleLabel = {
    admin:       'Admin',
    participant: 'MSc student',
  }[user?.role] || user?.role

  return (
    <aside className="w-60 flex-shrink-0 bg-surface border-r border-border
                      flex flex-col h-full">

      <div className="h-14 flex items-center px-4 border-b border-border">
        <Link2Off size={18} className="text-accent mr-2" />
        <span className="font-semibold text-sm">
          <span className="text-text-1">Chain</span>
          <span className="text-accent">Break</span>
        </span>
      </div>

      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm
               transition-colors mb-0.5 relative
               ${isActive
                 ? 'text-text-1 bg-accent/10 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-accent before:rounded-full'
                 : 'text-text-2 hover:text-text-1 hover:bg-surface-2'
               }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="my-2 border-t border-border" />
            <NavLink
              to="/admin/security"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                 transition-colors relative
                 ${isActive ? 'text-warning bg-warning/10' : 'text-text-2 hover:text-warning hover:bg-warning/5'}`
              }
            >
              <ShieldAlert size={16} />
              Security Centre
            </NavLink>
            <NavLink
              to="/admin/analytics"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                 transition-colors relative
                 ${isActive ? 'text-warning bg-warning/10' : 'text-text-2 hover:text-warning hover:bg-warning/5'}`
              }
            >
              <FlaskConical size={16} />
              Research Analytics
            </NavLink>
            <NavLink
              to="/admin/invites"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                 transition-colors relative
                 ${isActive ? 'text-warning bg-warning/10' : 'text-text-2 hover:text-warning hover:bg-warning/5'}`
              }
            >
              <Ticket size={16} />
              Invite codes
            </NavLink>
            {/* <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                 transition-colors relative
                 ${isActive
                   ? 'text-warning bg-warning/10 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-0.5 before:bg-warning before:rounded-full'
                   : 'text-text-2 hover:text-warning hover:bg-warning/5'
                 }`
              }
            >
              <ShieldAlert size={16} />
              Admin panel
            </NavLink> */}
          </>
        )}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30
                          flex items-center justify-center flex-shrink-0">
            <span className="text-accent text-xs font-medium">{initials}</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-text-1 text-sm font-medium truncate">
              {user?.username}
            </p>
            <p className="text-text-3 text-xs font-mono truncate">
              {roleLabel}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="text-text-3 hover:text-danger transition-colors
                       flex-shrink-0"
            title="Log out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
