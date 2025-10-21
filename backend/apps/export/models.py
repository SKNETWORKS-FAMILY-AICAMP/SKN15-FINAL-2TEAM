from django.db import models
from apps.plans.models import TripPlan


class ExportJob(models.Model):
    """
    Export job model - manages asynchronous export jobs for trip plans.
    Maps to the export_jobs table in the database.
    """

    JOB_TYPE_CHOICES = [
        ('pdf', 'PDF'),
        ('ics', 'ICS'),
        ('csv', 'CSV'),
    ]

    STATUS_CHOICES = [
        ('queued', 'Queued'),
        ('processing', 'Processing'),
        ('done', 'Done'),
        ('failed', 'Failed'),
    ]

    export_job_idx = models.AutoField(primary_key=True, db_column='export_job_idx')
    trip_idx = models.ForeignKey(
        TripPlan,
        on_delete=models.CASCADE,
        db_column='trip_idx',
        related_name='export_jobs'
    )
    job_type = models.TextField(choices=JOB_TYPE_CHOICES)
    status = models.TextField(choices=STATUS_CHOICES, default='queued')
    storage_uri = models.TextField(null=True, blank=True)
    error_msg = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'export_jobs'
        verbose_name = 'Export Job'
        verbose_name_plural = 'Export Jobs'
        constraints = [
            models.CheckConstraint(
                check=models.Q(job_type__in=['pdf', 'ics', 'csv']),
                name='export_jobs_job_type_check'
            ),
            models.CheckConstraint(
                check=models.Q(status__in=['queued', 'processing', 'done', 'failed']),
                name='export_jobs_status_check'
            ),
        ]

    def __str__(self):
        return f"{self.job_type.upper()} Export Job {self.export_job_idx} - {self.status}"
