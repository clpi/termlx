import React, { useState, useEffect } from 'react';
import './_group.css';
import {
  Activity,
  Terminal,
  Globe,
  Users,
  MessageSquare,
  Tag,
  Webhook,
  Clock,
  Image as ImageIcon,
  Send,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Play,
  Settings,
  Search,
  Plus,
  ShieldAlert,
  Hash,
  Box,
  Eye,
  ArrowUpRight,
  MonitorPlay,
  UserX,
  FileArchive,
  UploadCloud
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export function Console() {
  return (
    <div className="terax-theme min-h-screen w-full selection:bg-primary selection:text-primary-foreground relative overflow-y-auto bg-background text-foreground flex flex-col p-4 md:p-8">
      <div className="terax-scanline pointer-events-none" />
      
      {/* Header */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-border pb-6 mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="relative group cursor-crosshair">
            <Avatar className="h-16 w-16 border border-primary/50 rounded-none bg-surface transition-colors group-hover:border-primary">
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback className="rounded-none font-mono text-xl">0X</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-primary border-2 border-background">
              <div className="absolute inset-0 bg-primary animate-pulse-ring rounded-full" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight uppercase flex items-center gap-3">
              z3r0x
              <Badge variant="outline" className="font-mono bg-primary/10 text-primary border-primary/30 rounded-none text-[10px] h-5">SYS_ADMIN</Badge>
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground font-mono text-sm mt-1">
              <span>@z3r0x_sys</span>
              <span className="text-border">•</span>
              <span className="flex items-center gap-1 text-primary"><MonitorPlay className="w-3 h-3"/> CONNECTED [34ms]</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-6 md:gap-12">
          <Stat label="FOLLOWERS" value="14.2K" />
          <Stat label="FOLLOWING" value="128" />
          <Stat label="TOTAL POSTS" value="892" />
          <Stat label="SITE VISITS" value="1.2M" />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Post Composer */}
          <section className="bg-card border border-border p-6 relative group hover:border-primary/50 transition-colors shadow-2xl shadow-background">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-muted-foreground group-hover:text-foreground transition-colors">
                <Terminal className="w-4 h-4 text-primary" />
                COMPOSE_
              </h2>
              <Badge variant="outline" className="font-mono bg-primary/5 text-primary border-primary/20 rounded-none">READY</Badge>
            </div>
            
            <div className="space-y-4">
              <Input placeholder="Enter title (or / to use commands)" className="font-mono bg-background border-border focus-visible:ring-primary rounded-none text-lg h-12" />
              <Textarea placeholder="Write in markdown... (Press ⌘+Enter to preview)" className="font-mono bg-background border-border focus-visible:ring-primary rounded-none min-h-[180px] resize-none" />
              
              <div className="flex justify-between items-center pt-2">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-none border-border font-mono text-xs hover:text-primary hover:border-primary/50"><Hash className="w-4 h-4 mr-2"/> Add Tag</Button>
                  <Button variant="outline" size="sm" className="rounded-none border-border font-mono text-xs hover:text-primary hover:border-primary/50"><ImageIcon className="w-4 h-4 mr-2"/> Media</Button>
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" className="rounded-none font-mono text-xs hover:bg-transparent hover:text-primary">SAVE_DRAFT</Button>
                  <Button className="rounded-none bg-primary text-primary-foreground font-bold font-mono hover:bg-primary/90 shadow-[0_0_15px_rgba(0,229,255,0.4)]">
                    <Send className="w-4 h-4 mr-2"/> PUBLISH --NOW
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* Published Posts Feed */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Activity className="w-4 h-4" /> Recent Broadcasts
              </h2>
              <Button variant="ghost" size="sm" className="font-mono text-xs h-6 rounded-none hover:text-primary">VIEW_ALL [892]</Button>
            </div>
            
            <div className="space-y-3">
              {[
                { title: 'Understanding Zero-Knowledge Proofs in Rust', tags: ['cryptography', 'rust'], comments: 42, time: '2023-10-24T14:32:00Z', status: '200 OK' },
                { title: 'Why I stopped using ORMs', tags: ['database', 'hot-take'], comments: 128, time: '2023-10-21T09:15:00Z', status: '200 OK' },
                { title: 'Building a terminal emulator from scratch', tags: ['c++', 'systems'], comments: 56, time: '2023-10-18T18:45:00Z', status: '200 OK' }
              ].map((post, i) => (
                <div key={i} className="group bg-card border border-border p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-primary/50 transition-colors cursor-pointer">
                  <div className="space-y-2">
                    <h3 className="font-bold text-lg group-hover:text-primary transition-colors leading-tight">{post.title}</h3>
                    <div className="flex gap-2 font-mono text-xs">
                      {post.tags.map(tag => <span key={tag} className="text-muted-foreground group-hover:text-foreground transition-colors">#{tag}</span>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 md:gap-6 font-mono text-xs text-muted-foreground shrink-0 border-t md:border-t-0 md:border-l border-border pt-3 md:pt-0 md:pl-6 mt-2 md:mt-0">
                    <span className="flex items-center gap-1 group-hover:text-foreground"><MessageSquare className="w-3 h-3"/> {post.comments}</span>
                    <span className="flex items-center gap-1 text-green-500"><CheckCircle2 className="w-3 h-3"/> {post.status}</span>
                    <span>{new Date(post.time).toISOString().split('T')[0]}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Comments / Moderation */}
            <section className="bg-card border border-border p-5 flex flex-col h-[320px]">
               <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center justify-between">
                <span className="flex items-center gap-2"><ShieldAlert className="w-4 h-4"/> MOD_QUEUE</span>
                <Badge variant="outline" className="font-mono rounded-none h-5 border-warning/50 text-warning bg-warning/10">2 PENDING</Badge>
              </h2>
              <ScrollArea className="flex-1 pr-4 -mr-4">
                <div className="space-y-4">
                  {[
                    { user: 'cryptobro99', comment: 'Great post but have you heard about my new token? It solves all the problems you mentioned.', action: 'pending' },
                    { user: 'rustacean', comment: 'Actually, that is not entirely memory safe because the borrow checker cannot guarantee the lifetime here.', action: 'pending' }
                  ].map((c, i) => (
                    <div key={i} className="border-l-2 border-warning pl-3 py-1 space-y-2 group">
                      <div className="flex justify-between items-start">
                        <p className="font-mono text-xs text-primary">@{c.user}</p>
                        <span className="text-[9px] font-mono text-muted-foreground">1h ago</span>
                      </div>
                      <p className="text-sm line-clamp-3 text-muted-foreground group-hover:text-foreground transition-colors">{c.comment}</p>
                      <div className="flex gap-2 mt-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="outline" className="h-6 text-[10px] font-mono rounded-none hover:text-green-500 hover:border-green-500/50">APPROVE</Button>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] font-mono rounded-none text-destructive border-destructive/30 hover:bg-destructive hover:text-destructive-foreground">DROP</Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 rounded-none ml-auto text-muted-foreground hover:text-foreground"><MoreVertical className="w-3 h-3"/></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </section>
            
            {/* Followers / Following */}
            <section className="bg-card border border-border p-5 flex flex-col h-[320px]">
              <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4"/> NETWORK
                </h2>
                <div className="flex gap-2">
                  <span className="font-mono text-xs text-primary cursor-pointer border-b border-primary">Followers</span>
                  <span className="font-mono text-xs text-muted-foreground cursor-pointer hover:text-foreground">Following</span>
                </div>
              </div>
              <ScrollArea className="flex-1 pr-4 -mr-4">
                <div className="space-y-1">
                  {[
                    { user: 'alice_dev', role: 'engineer', status: 'online' },
                    { user: 'bob_the_builder', role: 'designer', status: 'offline' },
                    { user: 'charlie_root', role: 'sysadmin', status: 'online' },
                    { user: 'dave_null', role: 'bot', status: 'offline' },
                  ].map((u, i) => (
                    <div key={i} className="flex items-center justify-between p-2 hover:bg-surface border border-transparent hover:border-border transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-8 w-8 rounded-none border border-border">
                            <AvatarFallback className="text-[10px] font-mono bg-background text-muted-foreground">{u.user.substring(0,2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          {u.status === 'online' && <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-background" />}
                        </div>
                        <div>
                          <p className="font-mono text-xs font-bold group-hover:text-primary transition-colors">@{u.user}</p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{u.role}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 rounded-none text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all" title="Block User">
                        <UserX className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </section>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Public Site Status */}
          <section className="bg-primary text-primary-foreground p-5 relative overflow-hidden group cursor-pointer shadow-[0_0_20px_rgba(0,229,255,0.15)] hover:shadow-[0_0_30px_rgba(0,229,255,0.3)] transition-shadow">
            <div className="relative z-10">
              <h2 className="text-xs font-bold uppercase tracking-widest opacity-80 mb-2 flex items-center gap-2">
                <Globe className="w-4 h-4"/> PUBLIC_ENDPOINT
              </h2>
              <div className="text-2xl font-bold flex items-center gap-2 font-mono mt-2">
                LIVE <div className="w-2.5 h-2.5 bg-current rounded-full animate-pulse shadow-[0_0_10px_currentColor]" />
              </div>
              <div className="flex items-center justify-between mt-6">
                <p className="font-mono text-sm opacity-90 flex items-center gap-1 group-hover:underline decoration-1 underline-offset-4">
                  z3r0x.dev <ArrowUpRight className="w-3 h-3"/>
                </p>
                <div className="text-right">
                  <p className="text-[10px] opacity-70 uppercase tracking-wider">Current Visitors</p>
                  <p className="font-mono font-bold text-lg">342</p>
                </div>
              </div>
            </div>
            <Globe className="absolute -right-8 -bottom-8 w-40 h-40 opacity-10 group-hover:scale-110 transition-transform duration-700 ease-out" />
          </section>

          {/* Activity Log (Terminal) */}
          <section className="bg-[#050505] border border-border flex flex-col h-[320px] font-mono shadow-inner">
            <div className="border-b border-border p-2 px-3 flex items-center justify-between bg-surface">
              <div className="flex items-center gap-2 text-xs text-muted-foreground tracking-wider">
                <Terminal className="w-3 h-3"/> SYSTEM_STREAM
              </div>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-border" />
                <div className="w-2 h-2 rounded-full bg-border" />
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              </div>
            </div>
            <ScrollArea className="flex-1 p-3">
              <div className="text-[10px] sm:text-[11px] leading-relaxed space-y-1 text-muted-foreground font-mono">
                <div className="text-primary opacity-80">[SYS] Connection established on port 443</div>
                <div><span className="text-green-500">GET</span> /v1/users/z3r0x_sys <span className="text-foreground">200 OK</span> - 42ms</div>
                <div><span className="text-green-500">GET</span> /v1/posts?limit=10 <span className="text-foreground">200 OK</span> - 112ms</div>
                <div className="text-warning">[WRN] Rate limit warning for IP 192.168.1.1</div>
                <div><span className="text-blue-400">JOB</span> Cron schedule '*/15 * * * *' executed</div>
                <div><span className="text-purple-400">POST</span> /v1/webhooks/trigger <span className="text-foreground">202 ACCEPTED</span></div>
                <div className="text-destructive">[ERR] Webhook delivery failed: Connection timeout</div>
                <div>[SYS] Re-attempting webhook delivery (1/3)</div>
                <div><span className="text-purple-400">POST</span> /v1/webhooks/trigger <span className="text-foreground">200 OK</span></div>
                <div><span className="text-green-500">GET</span> /v1/comments?status=pending <span className="text-foreground">200 OK</span> - 15ms</div>
                <div><span className="text-green-500">GET</span> /v1/tags/taxonomy <span className="text-foreground">200 OK</span> - 8ms</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-primary">root@terax:~$</span> <span className="w-1.5 h-3.5 bg-primary animate-pulse inline-block" />
                </div>
              </div>
            </ScrollArea>
          </section>

          {/* Webhooks & Cron */}
          <section className="bg-card border border-border p-4 space-y-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 text-muted-foreground"><Webhook className="w-3 h-3 text-primary"/> WEBHOOKS</h3>
                <Button variant="ghost" size="icon" className="h-5 w-5 rounded-none text-muted-foreground hover:text-foreground"><Plus className="w-3 h-3"/></Button>
              </div>
              <div className="space-y-2">
                {[
                  { url: 'https://api.vercel.com/v1/deploy', events: ['post.publish'], status: 'ok' },
                  { url: 'https://discord.com/api/webhooks/...', events: ['post.publish', 'comment.new'], status: 'error' }
                ].map((hook, i) => (
                  <div key={i} className="flex flex-col gap-2 p-2 bg-background border border-border hover:border-primary/30 transition-colors">
                    <div className="flex justify-between items-center">
                      <code className="text-[10px] truncate max-w-[150px] text-muted-foreground">{hook.url}</code>
                      <div className={`w-1.5 h-1.5 rounded-full ${hook.status === 'ok' ? 'bg-green-500' : 'bg-destructive shadow-[0_0_5px_currentColor]'}`} />
                    </div>
                    <div className="flex gap-1.5">
                      {hook.events.map(e => <Badge key={e} variant="outline" className="text-[8px] h-3.5 px-1 rounded-none font-mono border-border text-muted-foreground">{e}</Badge>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 text-muted-foreground mb-3"><Clock className="w-3 h-3 text-primary"/> CRON_JOBS</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center font-mono text-[10px] bg-background p-2 border border-border">
                  <span className="text-muted-foreground tracking-widest">0 9 * * 1</span>
                  <span>Weekly Digest</span>
                  <Badge variant="outline" className="rounded-none h-4 px-1 text-[8px] border-primary/50 text-primary bg-primary/5">ACTIVE</Badge>
                </div>
                <div className="flex justify-between items-center font-mono text-[10px] bg-background p-2 border border-border">
                  <span className="text-muted-foreground tracking-widest">*/30 * * * *</span>
                  <span>Sync Analytics</span>
                  <Badge variant="outline" className="rounded-none h-4 px-1 text-[8px] border-border text-muted-foreground">PAUSED</Badge>
                </div>
              </div>
            </div>
          </section>

          {/* Custom Commands */}
          <section className="bg-card border border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 text-muted-foreground"><Terminal className="w-3 h-3 text-primary"/> CUSTOM_COMMANDS</h3>
              <Button variant="ghost" size="icon" className="h-5 w-5 rounded-none text-muted-foreground hover:text-foreground"><Plus className="w-3 h-3"/></Button>
            </div>
            <div className="space-y-2">
              {[
                { cmd: '/publish', desc: 'Ship draft to live + fan out webhooks', runs: '1.2K' },
                { cmd: '/draft', desc: 'Stash current buffer as a draft', runs: '880' },
                { cmd: '/deploy-site', desc: 'Rebuild & redeploy z3r0x.dev', runs: '214' },
                { cmd: '/digest', desc: 'Compile weekly digest from tags', runs: '52' }
              ].map((c, i) => (
                <div key={i} className="group flex items-center justify-between gap-3 p-2 bg-background border border-border hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <code className="font-mono text-xs text-primary shrink-0">{c.cmd}</code>
                    <span className="text-[10px] text-muted-foreground truncate group-hover:text-foreground transition-colors">{c.desc}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-[9px] text-muted-foreground/60 hidden sm:inline">{c.runs} runs</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 rounded-none text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-all" title="Run command"><Play className="w-3 h-3"/></Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Media & Tags (Compact) */}
          <div className="grid grid-cols-2 gap-6">
             <section className="bg-card border border-border p-4 flex flex-col group cursor-pointer hover:border-primary/30 transition-colors">
                <h3 className="font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 text-muted-foreground mb-3"><Tag className="w-3 h-3"/> TAXONOMY</h3>
                <div className="flex flex-wrap gap-1.5">
                  {['rust', 'systems', 'rants', 'web3', 'tools', 'devlog'].map(tag => (
                    <span key={tag} className="text-[10px] font-mono border border-border px-1.5 py-0.5 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors">#{tag}</span>
                  ))}
                </div>
             </section>

             <section className="bg-card border border-border p-4 flex flex-col group cursor-pointer hover:border-primary/30 transition-colors">
                <h3 className="font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 text-muted-foreground mb-3"><FileArchive className="w-3 h-3"/> MEDIA_LIB</h3>
                <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-border bg-background p-2 text-center group-hover:border-primary/30 transition-colors">
                  <UploadCloud className="w-4 h-4 text-muted-foreground mb-1 group-hover:text-primary transition-colors" />
                  <span className="text-[9px] font-mono text-muted-foreground">Upload File</span>
                  <span className="text-[8px] font-mono text-muted-foreground/50 mt-0.5">142 items total</span>
                </div>
             </section>
          </div>

        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase mb-1">{label}</span>
      <span className="text-2xl font-mono font-bold text-foreground drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]">{value}</span>
    </div>
  );
}
