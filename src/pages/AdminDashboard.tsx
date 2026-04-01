import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Coins, 
  ArrowDownUp, 
  ShieldCheck, 
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Shield,
  UserCog,
  GraduationCap,
  Eye,
  ExternalLink,
  Globe,
  FileText,
  Send,
  Link as LinkIcon
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ReportViewer } from "@/components/reports/ReportViewer";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { 
    isAdmin, 
    loading, 
    users, 
    withdrawalRequests, 
    transactions,
    fetchUsers,
    fetchWithdrawalRequests,
    fetchTransactions,
    processWithdrawal,
    updateUserRole
  } = useAdmin();

  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [mentorProfiles, setMentorProfiles] = useState<any[]>([]);
  const [securityReports, setSecurityReports] = useState<any[]>([]);
  const [reportDriveLink, setReportDriveLink] = useState("");
  const [driveLinkReport, setDriveLinkReport] = useState<any>(null); // for which report we are sending a link
  const [previewReport, setPreviewReport] = useState<any>(null); // for modal preview

  const fetchMentorProfiles = async () => {
    const { data, error } = await supabase.functions.invoke('admin-operations', {
      body: { action: 'get_mentor_profiles' }
    });
    if (!error && data?.profiles) {
      setMentorProfiles(data.profiles);
    }
  };

  const fetchSecurityReports = async () => {
    const { data, error } = await supabase.functions.invoke('admin-operations', {
      body: { action: 'get_security_reports' }
    });
    if (!error && data?.reports) {
      setSecurityReports(data.reports);
    }
  };

  const handleSendReport = async (reportId: string) => {
    if (!reportDriveLink.trim()) return;
    setProcessingId(reportId);
    const { error } = await supabase.functions.invoke('admin-operations', {
      body: { action: 'update_security_report', data: { reportId, reportUrl: reportDriveLink.trim(), reportStatus: 'completed' } }
    });
    if (!error) {
      toast({ title: "Report Sent", description: "Drive link sent to user successfully." });
      setReportDriveLink("");
      setDriveLinkReport(null);
      await fetchSecurityReports();
    } else {
      toast({ title: "Error", description: "Failed to update report", variant: "destructive" });
    }
    setProcessingId(null);
  };

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/');
    }
  }, [loading, isAdmin, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchWithdrawalRequests();
      fetchTransactions();
      fetchMentorProfiles();
      fetchSecurityReports();
    }
  }, [isAdmin]);

  const handleApproveMentor = async (profileId: string) => {
    setProcessingId(profileId);
    const { error } = await supabase.functions.invoke('admin-operations', {
      body: { action: 'approve_mentor', data: { profileId } }
    });
    if (!error) {
      await fetchMentorProfiles();
    }
    setProcessingId(null);
  };

  const handleProcessWithdrawal = async (status: 'approved' | 'rejected' | 'completed') => {
    if (!selectedRequest) return;
    
    setProcessingId(selectedRequest.id);
    await processWithdrawal(selectedRequest.id, status, adminNotes);
    setSelectedRequest(null);
    setAdminNotes("");
    setProcessingId(null);
  };

  const handleToggleRole = async (userId: string, role: 'admin' | 'moderator', currentRoles: string[]) => {
    const hasRole = currentRoles.includes(role);
    await updateUserRole(userId, role, hasRole ? 'remove' : 'add');
  };

  const filteredUsers = users.filter(user => 
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phone?.includes(searchTerm)
  );

  const pendingWithdrawals = withdrawalRequests.filter(r => r.status === 'pending');

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen pt-24 pb-16 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <Layout>
      <div className="min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="mb-8 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary/10">
              <ShieldCheck className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              <p className="text-muted-foreground">Manage users, withdrawals, and platform activity</p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Total Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold">{users.length}</span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-500" />
                  Pending Withdrawals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold text-orange-500">{pendingWithdrawals.length}</span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ArrowDownUp className="w-4 h-4" />
                  Total Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold">{transactions.length}</span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Coins className="w-4 h-4 text-green-500" />
                  Total Coins in Circulation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <span className="text-3xl font-bold text-green-500">
                  {users.reduce((sum, u) => sum + (u.coinBalance || 0), 0)}
                </span>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="withdrawals" className="space-y-6">
            <TabsList>
              <TabsTrigger value="withdrawals" className="relative">
                Withdrawals
                {pendingWithdrawals.length > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-red-500">
                    {pendingWithdrawals.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="mentors">Mentors</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="security" className="relative">
                Security
                {securityReports.filter(r => r.report_status === 'pending').length > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-red-500">
                    {securityReports.filter(r => r.report_status === 'pending').length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="withdrawals">
              <Card>
                <CardHeader>
                  <CardTitle>Withdrawal Requests</CardTitle>
                  <CardDescription>Review and process user withdrawal requests</CardDescription>
                </CardHeader>
                <CardContent>
                  {withdrawalRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No withdrawal requests</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>UPI ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {withdrawalRequests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell className="font-medium">{request.userName}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Coins className="w-4 h-4 text-primary" />
                                {request.amount}
                              </div>
                            </TableCell>
                            <TableCell>{request.upi_id || 'N/A'}</TableCell>
                            <TableCell>
                              {request.status === 'pending' && (
                                <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>
                              )}
                              {request.status === 'approved' && (
                                <Badge className="bg-blue-500"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>
                              )}
                              {request.status === 'completed' && (
                                <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>
                              )}
                              {request.status === 'rejected' && (
                                <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Rejected</Badge>
                              )}
                            </TableCell>
                            <TableCell>{format(new Date(request.created_at), 'PP')}</TableCell>
                            <TableCell>
                              {request.status === 'pending' && (
                                <Button 
                                  size="sm" 
                                  onClick={() => setSelectedRequest(request)}
                                >
                                  Review
                                </Button>
                              )}
                              {request.status === 'approved' && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedRequest(request);
                                    handleProcessWithdrawal('completed');
                                  }}
                                >
                                  Mark Complete
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>View and manage all platform users</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Coins</TableHead>
                        <TableHead>Mentor</TableHead>
                        <TableHead>Roles</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell>{user.phone || 'N/A'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Coins className="w-4 h-4 text-primary" />
                              {user.coinBalance}
                            </div>
                          </TableCell>
                          <TableCell>
                            {user.is_available_as_mentor ? (
                              <Badge className="bg-green-500">Active</Badge>
                            ) : (
                              <Badge variant="secondary">No</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {user.roles.map(role => (
                                <Badge key={role} variant={role === 'admin' ? 'default' : 'outline'}>
                                  {role}
                                </Badge>
                              ))}
                              {user.roles.length === 0 && (
                                <Badge variant="secondary">user</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{format(new Date(user.created_at), 'PP')}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant={user.roles.includes('admin') ? 'destructive' : 'outline'}
                                onClick={() => handleToggleRole(user.user_id, 'admin', user.roles)}
                              >
                                <Shield className="w-3 h-3 mr-1" />
                                {user.roles.includes('admin') ? 'Remove Admin' : 'Make Admin'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Mentors Tab */}
                  <TabsContent value="mentors">
              <Card>
                <CardHeader>
                  <CardTitle>Mentor Profiles</CardTitle>
                  <CardDescription>Users who have enabled "Available as Mentor" on their profile</CardDescription>
                </CardHeader>
                <CardContent>
                  {mentorProfiles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No mentor profiles yet. Users need to enable "Available as Mentor" in their profile first.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Skills</TableHead>
                            <TableHead>Rate (coins/hr)</TableHead>
                            <TableHead>Experience</TableHead>
                            <TableHead>Bio</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mentorProfiles.map((profile: any) => (
                            <TableRow key={profile.id}>
                              <TableCell className="font-medium">{profile.full_name}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1 max-w-[200px]">
                                  {(profile.skills || []).slice(0, 3).map((s: string) => (
                                    <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                                  ))}
                                  {(profile.skills || []).length > 3 && (
                                    <Badge variant="secondary" className="text-xs">+{profile.skills.length - 3}</Badge>
                                  )}
                                  {(!profile.skills || profile.skills.length === 0) && (
                                    <span className="text-xs text-muted-foreground">No skills listed</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {profile.hourly_rate ? (
                                  <span className="flex items-center gap-1">
                                    <Coins className="w-3 h-3" />
                                    {profile.hourly_rate}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-sm">Not set</span>
                                )}
                              </TableCell>
                              <TableCell>{profile.experience_years || 0} yrs</TableCell>
                              <TableCell className="max-w-xs">
                                <p className="text-sm truncate">{profile.bio || 'No bio provided'}</p>
                              </TableCell>
                              <TableCell>
                                {profile.mentor_approved ? (
                                  <Badge className="bg-green-500 text-white">Approved ✓</Badge>
                                ) : (
                                  <Badge variant="secondary" className="bg-yellow-500 text-white">Pending Review</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {!profile.mentor_approved ? (
                                  <Button
                                    size="sm"
                                    onClick={() => handleApproveMentor(profile.id)}
                                    disabled={processingId === profile.id}
                                    className="gap-1"
                                  >
                                    {processingId === profile.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <CheckCircle className="w-3 h-3" />
                                    )}
                                    Approve
                                  </Button>
                                ) : (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    Approved
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="transactions">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Transactions</CardTitle>
                  <CardDescription>All coin transactions across the platform</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell>
                            <Badge variant={
                              ['purchase', 'earn', 'refund'].includes(tx.type) 
                                ? 'default' 
                                : 'secondary'
                            }>
                              {tx.type}
                            </Badge>
                          </TableCell>
                          <TableCell className={
                            ['purchase', 'earn', 'refund'].includes(tx.type)
                              ? 'text-green-500 font-medium'
                              : 'text-red-500 font-medium'
                          }>
                            {['purchase', 'earn', 'refund'].includes(tx.type) ? '+' : '-'}
                            {tx.amount}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {tx.description || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={tx.status === 'completed' ? 'default' : 'secondary'}>
                              {tx.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(tx.created_at), 'PPp')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Reports Tab */}
            <TabsContent value="security">
              <Card>
                <CardHeader>
                  <CardTitle>Security Scan Requests</CardTitle>
                  <CardDescription>Users who submitted URLs for security scanning. Send them the report via Google Drive link.</CardDescription>
                </CardHeader>
                <CardContent>
                  {securityReports.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Globe className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No security scan requests yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {securityReports.map((report: any) => (
                        <div key={report.id} className="p-4 rounded-xl border border-border bg-card/50 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">{report.userName}</span>
                                {report.userPhone && <span className="text-sm text-muted-foreground">({report.userPhone})</span>}
                                <Badge variant={report.report_status === 'completed' ? 'default' : 'secondary'}>
                                  {report.report_status === 'completed' ? 'Report Sent' : 'Pending'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <Globe className="w-3 h-3 text-muted-foreground" />
                                <a href={report.website_url.startsWith('http') ? report.website_url : `https://${report.website_url}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline break-all">
                                  {report.website_url}
                                </a>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {report.scan_type?.toUpperCase()} • Submitted {format(new Date(report.created_at), 'PPp')}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {report.report_status === 'completed' && report.report_url && (
                                <a href={report.report_url} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" variant="outline" className="gap-1">
                                    <ExternalLink className="w-3 h-3" /> Open Drive
                                  </Button>
                                </a>
                              )}
                              {report.report_status === 'completed' && (
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="gap-1"
                                  onClick={() => setPreviewReport(report)}
                                >
                                  <Eye className="w-3 h-3" /> Preview
                                </Button>
                              )}
                            </div>
                          </div>
                          
                          {report.report_status !== 'completed' && (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Input
                                placeholder="Paste Google Drive link here..."
                                value={driveLinkReport?.id === report.id ? reportDriveLink : ''}
                                onChange={(e) => {
                                  setDriveLinkReport(report);
                                  setReportDriveLink(e.target.value);
                                }}
                                onFocus={() => setDriveLinkReport(report)}
                                className="flex-1"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSendReport(report.id)}
                                disabled={processingId === report.id || !reportDriveLink.trim() || driveLinkReport?.id !== report.id}
                                className="gap-1"
                              >
                                {processingId === report.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                Send Report
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Withdrawal Review Dialog */}
      <Dialog open={!!selectedRequest && selectedRequest.status === 'pending'} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Withdrawal Request</DialogTitle>
            <DialogDescription>
              Process withdrawal request from {selectedRequest?.userName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Amount</Label>
                <p className="text-2xl font-bold flex items-center gap-2">
                  <Coins className="w-5 h-5 text-primary" />
                  {selectedRequest?.amount}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">UPI ID</Label>
                <p className="font-medium">{selectedRequest?.upi_id || 'N/A'}</p>
              </div>
            </div>

            <div>
              <Label>Admin Notes (optional)</Label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add notes about this decision..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={() => handleProcessWithdrawal('rejected')}
              disabled={!!processingId}
            >
              {processingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 mr-1" />}
              Reject
            </Button>
            <Button
              onClick={() => handleProcessWithdrawal('approved')}
              disabled={!!processingId}
            >
              {processingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Preview Modal */}
      <Dialog open={!!previewReport} onOpenChange={() => setPreviewReport(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">Security Report</DialogTitle>
          <ReportViewer report={previewReport} onClose={() => setPreviewReport(null)} />
        </DialogContent>
      </Dialog>
    </Layout>
  );
                      }
