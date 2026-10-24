$ErrorActionPreference = "Stop"
$base = "http://localhost:5000/api"
$email = "smoke-test-$(Get-Random)@example.com"
$pass = "Passw0rd123"

function J($r) { $r | ConvertTo-Json -Depth 5 -Compress }

# 1. Health
$h = Invoke-RestMethod "$base/health"
Write-Output "HEALTH: status=$($h.status) db=$($h.db)"

# 2. Register
try { $reg = Invoke-RestMethod "$base/auth/register" -Method Post -ContentType "application/json" -Body (@{email=$email; password=$pass; confirmPassword=$pass; name="Smoke Tester"} | ConvertTo-Json) ; Write-Output "REGISTER: ok user=$($reg.data.user.email)" } catch { Write-Output "REGISTER: FAIL $($_.ErrorDetails.Message)"; exit 1 }
$token = $reg.data.token

# 3. Duplicate register -> 409
try { Invoke-RestMethod "$base/auth/register" -Method Post -ContentType "application/json" -Body (@{email=$email; password=$pass; confirmPassword=$pass; name="dup"} | ConvertTo-Json) | Out-Null; Write-Output "DUP-REGISTER: FAIL (should have been 409)" } catch { Write-Output "DUP-REGISTER: status=$($_.Exception.Response.StatusCode.value__) (expected 409)" }

# 4. Weak password -> 400
try { Invoke-RestMethod "$base/auth/register" -Method Post -ContentType "application/json" -Body (@{email="weak$($email)"; password="short"} | ConvertTo-Json) | Out-Null; Write-Output "WEAK-PW: FAIL (should be 400)" } catch { Write-Output "WEAK-PW: status=$($_.Exception.Response.StatusCode.value__) (expected 400)" }

# 5. Login wrong password -> 401
try { Invoke-RestMethod "$base/auth/login" -Method Post -ContentType "application/json" -Body (@{email=$email; password="WrongPass1"} | ConvertTo-Json) | Out-Null; Write-Output "BAD-LOGIN: FAIL (should be 401)" } catch { Write-Output "BAD-LOGIN: status=$($_.Exception.Response.StatusCode.value__) (expected 401)" }

# 6. Login ok
$login = Invoke-RestMethod "$base/auth/login" -Method Post -ContentType "application/json" -Body (@{email=$email; password=$pass} | ConvertTo-Json)
Write-Output "LOGIN: ok"

# 7. /me
$me = Invoke-RestMethod "$base/auth/me" -Headers @{Authorization="Bearer $token"}
Write-Output "ME: email=$($me.data.user.email)"

# 8. Tasks without token -> 401
try { Invoke-RestMethod "$base/tasks" | Out-Null; Write-Output "NO-TOKEN: FAIL (should be 401)" } catch { Write-Output "NO-TOKEN: status=$($_.Exception.Response.StatusCode.value__) (expected 401)" }

$auth = @{Authorization = "Bearer $token"}

# 9. Create tasks (varied priority/deadline)
$now = [DateTimeOffset]::UtcNow
$t1 = Invoke-RestMethod "$base/tasks" -Method Post -ContentType "application/json" -Headers $auth -Body (@{title="Overdue high"; description="x"; priority="high"; deadline=$now.AddHours(-2).ToString("o"); tags=@("urgent")} | ConvertTo-Json)
$t2 = Invoke-RestMethod "$base/tasks" -Method Post -ContentType "application/json" -Headers $auth -Body (@{title="Soon low"; priority="low"; deadline=$now.AddHours(5).ToString("o")} | ConvertTo-Json)
$t3 = Invoke-RestMethod "$base/tasks" -Method Post -ContentType "application/json" -Headers $auth -Body (@{title="No deadline medium"; priority="medium"} | ConvertTo-Json)
Write-Output "CREATE: 3 tasks ok ($($t1.data.task._id.Substring(0,8))... $($_.Count))"

# 10. List with smart sort: expect overdue-high first, no-deadline medium last, completed after
$comp = Invoke-RestMethod "$base/tasks/$($t3.data.task._id)/complete" -Method Patch -ContentType "application/json" -Headers $auth -Body '{}'
Write-Output "COMPLETE: status=$($comp.data.task.status) completedAt set=$($null -ne $comp.data.task.completedAt)"
$list = (Invoke-RestMethod "$base/tasks" -Headers $auth).data.tasks
Write-Output "SMART-SORT: $($list.title -join ' | ')"
Write-Output "  overdue first: $($list[0].title -eq 'Overdue high') / completed last: $($list[-1].title -eq 'No deadline medium')"

# 11. Filters
$f1 = (Invoke-RestMethod "$base/tasks?priority=high" -Headers $auth).data.tasks
$f2 = (Invoke-RestMethod "$base/tasks?status=completed" -Headers $auth).data.tasks
$f3 = (Invoke-RestMethod "$base/tasks?search=overdue" -Headers $auth).data.tasks
Write-Output "FILTERS: priority-high=$($f1.Count) completed=$($f2.Count) search=$($f3.Count) (expect 1,1,1)"

# 12. Update
$upd = Invoke-RestMethod "$base/tasks/$($t2.data.task._id)" -Method Patch -ContentType "application/json" -Headers $auth -Body (@{title="Renamed low"; category="work"; tags=@("a","b")} | ConvertTo-Json)
Write-Output "UPDATE: title=$($upd.data.task.title) category=$($upd.data.task.category) tags=$($upd.data.task.tags -join ',')"

# 13. Get single
$one = Invoke-RestMethod "$base/tasks/$($t2.data.task._id)" -Headers $auth
Write-Output "GET-ONE: $((Invoke-RestMethod "$base/tasks/$($t2.data.task._id)" -Headers $auth).data.task.title)"

# 14. Invalid id -> 400; random valid id -> 404
try { Invoke-RestMethod "$base/tasks/not-an-id" -Headers $auth | Out-Null; Write-Output "BAD-ID: FAIL (should be 400)" } catch { Write-Output "BAD-ID: status=$($_.Exception.Response.StatusCode.value__) (expected 400)" }
try { Invoke-RestMethod "$base/tasks/65f0a1b2c3d4e5f6a7b8c9d0" -Headers $auth | Out-Null; Write-Output "MISSING-ID: FAIL (should be 404)" } catch { Write-Output "MISSING-ID: status=$($_.Exception.Response.StatusCode.value__) (expected 404)" }

# 15. Delete + verify gone
Invoke-RestMethod "$base/tasks/$($t1.data.task._id)" -Method Delete -Headers $auth | Out-Null
try { Invoke-RestMethod "$base/tasks/$($t1.data.task._id)" -Headers $auth | Out-Null; Write-Output "DELETE: FAIL (task still exists)" } catch { Write-Output "DELETE: status=$($_.Exception.Response.StatusCode.value__) (expected 404 after delete)" }

# 16. Tampered token -> 401
try { Invoke-RestMethod "$base/tasks" -Headers @{Authorization="Bearer $token-xyz"} | Out-Null; Write-Output "TAMPER-TOKEN: FAIL" } catch { Write-Output "TAMPER-TOKEN: status=$($_.Exception.Response.StatusCode.value__) (expected 401)" }

Write-Output "ALL SMOKE TESTS FINISHED"
