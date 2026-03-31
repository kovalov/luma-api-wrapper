const axios = require('axios');
const config = require('../config');

const client = axios.create({
  baseURL: config.LUMA_BASE_URL,
  timeout: 15000,
});

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchBootstrap() {
  const { data } = await client.get('/discover/bootstrap-page');
  return data;
}

async function paginateEvents(params, pageDelay = 300) {
  const allEntries = [];
  let cursor = null;

  while (true) {
    const queryParams = { ...params, pagination_limit: 25 };
    if (cursor) {
      queryParams.pagination_cursor = cursor;
    }

    const { data } = await client.get('/discover/get-paginated-events', {
      params: queryParams,
    });

    allEntries.push(...(data.entries || []));

    if (!data.has_more) break;
    cursor = data.next_cursor;
    await delay(pageDelay);
  }

  return allEntries;
}

async function paginateCalendarEvents(calendarApiId, pageDelay = 300) {
  const allEntries = [];
  let cursor = null;

  while (true) {
    const params = {
      calendar_api_id: calendarApiId,
      pagination_limit: 20,
      period: 'future',
    };
    if (cursor) {
      params.pagination_cursor = cursor;
    }

    const { data } = await client.get('/calendar/get-items', { params });

    allEntries.push(...(data.entries || []));

    if (!data.has_more) break;
    cursor = data.next_cursor;
    await delay(pageDelay);
  }

  return allEntries;
}

async function fetchEventDetail(eventApiId) {
  const { data } = await client.get('/event/get', {
    params: { event_api_id: eventApiId },
  });
  return data;
}

module.exports = { fetchBootstrap, paginateEvents, paginateCalendarEvents, fetchEventDetail, delay };
