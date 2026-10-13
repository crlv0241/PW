FROM mysql:8.0

# Copy custom MySQL configuration optimized for POS & WMS
COPY my.cnf /etc/mysql/conf.d/custom.cnf

# Ensure proper configuration file permissions
RUN chmod 644 /etc/mysql/conf.d/custom.cnf

# Expose default MySQL port
EXPOSE 3306

CMD ["mysqld"]
