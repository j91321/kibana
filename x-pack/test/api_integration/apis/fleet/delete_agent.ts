/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import expect from '@kbn/expect';
import { FtrProviderContext } from '../../ftr_provider_context';
import { SecurityService } from '../../../common/services';

export default function({ getService }: FtrProviderContext) {
  const esArchiver = getService('esArchiver');
  const supertest = getService('supertestWithoutAuth');
  const security: SecurityService = getService('security');
  const users: { [rollName: string]: { username: string; password: string; permissions?: any } } = {
    fleet_user: {
      permissions: {
        feature: {
          fleet: ['read'],
        },
        spaces: ['*'],
      },
      username: 'fleet_user',
      password: 'changeme',
    },
    fleet_admin: {
      permissions: {
        feature: {
          fleet: ['all'],
        },
        spaces: ['*'],
      },
      username: 'fleet_admin',
      password: 'changeme',
    },
  };
  describe('fleet_delete_agent', () => {
    before(async () => {
      for (const roleName in users) {
        if (users.hasOwnProperty(roleName)) {
          const user = users[roleName];

          if (user.permissions) {
            await security.role.create(roleName, {
              kibana: [user.permissions],
            });
          }

          // Import a repository first
          await security.user.create(user.username, {
            password: user.password,
            roles: [roleName],
            full_name: user.username,
          });
        }
      }

      await esArchiver.loadIfNeeded('fleet/agents');
    });
    after(async () => {
      await esArchiver.unload('fleet/agents');
    });

    it('should return a 404 if user lacks fleet-write permissions', async () => {
      const { body: apiResponse } = await supertest
        .delete(`/api/fleet/agents/agent1`)
        .auth(users.fleet_user.username, users.fleet_user.password)
        .set('kbn-xsrf', 'xx')
        .expect(404);

      expect(apiResponse).not.to.eql({
        success: true,
        action: 'deleted',
      });
    });

    it('should return a 404 if there is no agent to delete', async () => {
      await supertest
        .delete(`/api/fleet/agents/i-do-not-exist`)
        .auth(users.fleet_admin.username, users.fleet_admin.password)
        .set('kbn-xsrf', 'xx')
        .expect(404);
    });

    it('should return a 200 after deleting an agent', async () => {
      const { body: apiResponse } = await supertest
        .delete(`/api/fleet/agents/agent1`)
        .auth(users.fleet_admin.username, users.fleet_admin.password)
        .set('kbn-xsrf', 'xx')
        .expect(200);
      expect(apiResponse).to.eql({
        success: true,
        action: 'deleted',
      });
    });
  });
}